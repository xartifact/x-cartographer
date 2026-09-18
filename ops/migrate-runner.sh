#!/usr/bin/env bash
#
# GitHub Actions runner 迁移到 AUR 包（github-actions-bin）
#
# 背景：原 runner 是手动下载二进制（~/runner-new），systemd 服务以 binzhan 用户运行，
# 部署 job 依赖 ~/Docker/ 下的 compose 文件。AUR 包的设计是：
#   - 专用系统用户 github-actions
#   - 沙箱加固：ProtectHome=yes + InaccessiblePaths=/home /root /srv
#   - 仅允许写 /var/lib/github-actions
# 因此部署目录必须从 ~/Docker 迁出（/home 被禁），且运行用户需 docker 权限。
#
# 方案：部署目录迁到 /opt/xartifact/，用 drop-in 为包服务补充必要权限。
#
# 分阶段执行（每步独立，可单独运行）：
#   bash migrate-runner.sh prepare    # 建目录 + 迁移文件（不碰运行中的服务）
#   bash migrate-runner.sh dropin     # 写 systemd drop-in（需 root）
#   bash migrate-runner.sh switch     # 停旧 runner、启用新服务（需 root）
#   bash migrate-runner.sh verify     # 验证
#   bash migrate-runner.sh rollback   # 回滚到手动 runner
#
# 无参数 = 只打印计划，不执行。
#
set -euo pipefail

NEW_ROOT="/opt/xartifact"
OLD_ROOT="${HOME}/Docker"
REPOS=(x-cartographer x-herald)

PKG_SERVICE="github-actions.service"
OLD_SERVICE="actions.runner.xartifact.x99-arch-server.service"
DROPIN_DIR="/etc/systemd/system/${PKG_SERVICE}.d"
DROPIN_FILE="${DROPIN_DIR}/xartifact.conf"

RUNNER_USER="github-actions"

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "✗ 此步骤需要 root（sudo bash $0 $1）" >&2
    exit 1
  fi
}

# ── prepare：建目录、迁移部署文件（不需 root，但需能写 /opt → 实际需要）──
cmd_prepare() {
  need_root prepare
  echo "=== 1. 创建部署根目录 ${NEW_ROOT} ==="
  mkdir -p "${NEW_ROOT}"
  # runner 需读写这些目录（拉镜像、写 compose 状态、改 .env）
  chown -R "${RUNNER_USER}:${RUNNER_USER}" "${NEW_ROOT}"
  chmod 775 "${NEW_ROOT}"

  for repo in "${REPOS[@]}"; do
    local src="${OLD_ROOT}/${repo}"
    local dst="${NEW_ROOT}/${repo}"
    if [[ ! -d "${src}" ]]; then
      echo "  [skip] ${src} 不存在"
      continue
    fi
    if [[ -d "${dst}" ]]; then
      echo "  [skip] ${dst} 已存在（避免覆盖，如需重建请先手动删除）"
      continue
    fi
    echo "  ${src} → ${dst}"
    cp -a "${src}" "${dst}"
    chown -R "${RUNNER_USER}:${RUNNER_USER}" "${dst}"
    # .env 含数据库密码
    chmod 640 "${dst}/.env" 2>/dev/null || true
  done

  echo
  echo "=== 2. 目录属主 ==="
  ls -ld "${NEW_ROOT}" "${NEW_ROOT}"/*/ 2>/dev/null || true

  echo
  echo "✓ prepare 完成。**旧目录保留未删**，确认新目录可用后再手动清理："
  echo "    rm -rf ${OLD_ROOT}/x-cartographer ${OLD_ROOT}/x-herald"
}

# ── dropin：为包服务补充 xartifact 所需权限 ──
cmd_dropin() {
  need_root dropin
  echo "=== 写 drop-in: ${DROPIN_FILE} ==="
  mkdir -p "${DROPIN_DIR}"
  cat > "${DROPIN_FILE}" <<EOF
# xartifact 部署所需的额外权限（覆盖 AUR 包默认沙箱）
#
# 包默认：User=github-actions、ProtectHome=yes、InaccessiblePaths=/home /root /srv、
#         ReadWritePaths=/var/lib/github-actions
# 我们的部署：compose 文件在 /opt/xartifact/，需 docker 访问，需 Restart=always
[Service]
# 部署目录在 /opt（不在包的 InaccessiblePaths 中，但仍需显式允许写）
ReadWritePaths=/var/lib/github-actions ${NEW_ROOT}
# runner 崩溃/被杀后自动重启（2026-09-15 事故：默认 Restart=no 导致静默离线）
Restart=always
RestartSec=10
EOF
  cat "${DROPIN_FILE}"

  echo
  echo "=== 将 ${RUNNER_USER} 加入 docker 组（socket 为 root:docker 660）==="
  if id -nG "${RUNNER_USER}" | grep -qw docker; then
    echo "  已在 docker 组，跳过"
  else
    usermod -aG docker "${RUNNER_USER}"
    echo "  ✓ 已加入（注意：需重启服务才生效）"
  fi

  echo
  echo "=== 校验 drop-in 生效 ==="
  systemctl daemon-reload
  systemctl show "${PKG_SERVICE}" -p User -p ReadWritePaths -p Restart -p ProtectHome
}

# ── switch：停旧 runner，启用包服务 ──
cmd_switch() {
  need_root switch
  echo "=== 停用旧手动 runner ==="
  systemctl stop "${OLD_SERVICE}" 2>/dev/null || true
  systemctl disable "${OLD_SERVICE}" 2>/dev/null || true
  echo "  ✓ 旧服务已停用（unit 文件保留，可用 rollback 恢复）"

  echo
  echo "=== 新 runner 需要重新注册（AUR 包用独立凭据目录）==="
  echo "  若 ${RUNNER_USER} 尚未注册，需执行："
  echo "    sudo -u ${RUNNER_USER} HOME=/var/lib/github-actions \\"
  echo "      /var/lib/github-actions/bin/config.sh \\"
  echo "      --url https://github.com/xartifact --token <RUNNER_TOKEN> \\"
  echo "      --name x99-arch-server --labels self-hosted,linux,x64 --unattended"
  echo "  （token 从 GitHub 获取：Settings → Actions → Runners → New runner）"
  echo
  echo "  注册完成后启动："
  echo "    sudo systemctl enable --now ${PKG_SERVICE}"
}

# ── verify ──
cmd_verify() {
  echo "=== 服务状态 ==="
  systemctl show "${PKG_SERVICE}" -p ActiveState -p SubState -p Restart -p MainPID -p User 2>/dev/null || true
  echo
  echo "=== 旧服务应已停 ==="
  systemctl is-active "${OLD_SERVICE}" 2>/dev/null || echo "  inactive（符合预期）"
  echo
  echo "=== 部署目录 ==="
  ls -ld "${NEW_ROOT}"/*/ 2>/dev/null || echo "  未创建"
  echo
  echo "=== GitHub 侧 runner 状态 ==="
  echo "  gh api /orgs/xartifact/actions/runners --jq '.runners[] | {name,status,busy}'"
}

# ── rollback ──
cmd_rollback() {
  need_root rollback
  echo "=== 回滚到手动 runner ==="
  systemctl stop "${PKG_SERVICE}" 2>/dev/null || true
  systemctl disable "${PKG_SERVICE}" 2>/dev/null || true
  rm -rf "${DROPIN_DIR}"
  systemctl daemon-reload
  systemctl enable --now "${OLD_SERVICE}"
  echo "  ✓ 已恢复旧服务"
  systemctl show "${OLD_SERVICE}" -p ActiveState -p MainPID
  echo
  echo "  部署目录如需回退："
  echo "    sudo rm -rf ${NEW_ROOT} && cp -a ${OLD_ROOT}/<repo> ${NEW_ROOT}/  （反向操作）"
}

case "${1:-plan}" in
  prepare) cmd_prepare ;;
  dropin) cmd_dropin ;;
  switch) cmd_switch ;;
  verify) cmd_verify ;;
  rollback) cmd_rollback ;;
  *)
    cat <<'PLAN'
GitHub Actions runner 迁移计划（AUR 包 github-actions-bin）

背景冲突：
  包设计        User=github-actions + ProtectHome=yes + InaccessiblePaths=/home
  现有部署      compose 在 ~/Docker/（/home 下），靠 binzhan 的 docker 组权限

方案：部署目录迁到 /opt/xartifact/（不在 InaccessiblePaths 中）

步骤（依次执行，每步可单独跑）：
  1. sudo bash migrate-runner.sh prepare    # 建 /opt/xartifact + 复制 compose/.env
  2. sudo bash migrate-runner.sh dropin     # 写 drop-in（ReadWritePaths + Restart=always）+ 加 docker 组
  3. # 注册新 runner（需 GitHub token，见 switch 输出）
     sudo bash migrate-runner.sh switch     # 停旧 runner，打印注册命令
  4. sudo bash migrate-runner.sh verify     # 验证
  回滚：
     sudo bash migrate-runner.sh rollback

随后需改两仓库 workflow 的 DEPLOY_DIR：
  ~/Docker/x-cartographer  →  /opt/xartifact/x-cartographer
  ~/Docker/x-herald        →  /opt/xartifact/x-herald
PLAN
    ;;
esac
