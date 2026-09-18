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
# 注意：sudo 下 HOME 会变成 /root，故用绝对路径而非 ${HOME}
OWNER_HOME="/home/binzhan"
OLD_ROOT="${OWNER_HOME}/Docker"
OLD_RUNNER_DIR="${OWNER_HOME}/runner-new"
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
  # 复用现有 runner 身份（agentId 95 / x99-arch-server），不重新注册。
  # 前提：两版二进制版本一致（均 2.337.0，已核实）。
  echo "=== 1. 复制现有 runner 凭据到包的工作目录 ==="
  local creds=(.runner .credentials .credentials_rsaparams)
  for f in "${creds[@]}"; do
    if [[ -f "${OLD_RUNNER_DIR}/${f}" ]]; then
      cp -a "${OLD_RUNNER_DIR}/${f}" "/var/lib/github-actions/${f}"
      echo "  ✓ ${f}"
    else
      echo "  ✗ 缺少 ${f} —— 无法复用，需重新注册" >&2
      exit 1
    fi
  done
  chown "${RUNNER_USER}:${RUNNER_USER}" /var/lib/github-actions/.runner \
    /var/lib/github-actions/.credentials /var/lib/github-actions/.credentials_rsaparams
  # 私钥文件保持 600（含 RSA 私钥）
  chmod 600 /var/lib/github-actions/.credentials_rsaparams
  chmod 644 /var/lib/github-actions/.runner /var/lib/github-actions/.credentials

  echo
  echo "=== 2. 停用旧手动 runner ==="
  # 必须先停：.runner 里的 agentName 是唯一身份，两个进程同跑会被 GitHub 拒绝
  systemctl stop "${OLD_SERVICE}" 2>/dev/null || true
  systemctl disable "${OLD_SERVICE}" 2>/dev/null || true
  echo "  ✓ 旧服务已停用（unit 文件保留，可用 rollback 恢复）"

  echo
  echo "=== 3. 启用并启动包服务 ==="
  systemctl enable --now "${PKG_SERVICE}"
  sleep 5
  systemctl show "${PKG_SERVICE}" -p ActiveState -p SubState -p MainPID -p User
  echo
  echo "  若未 active，查日志：journalctl -u ${PKG_SERVICE} -n 40 --no-pager"
}

# ── verify ──
cmd_verify() {
  echo "=== 服务状态 ==="
  systemctl show "${PKG_SERVICE}" -p ActiveState -p SubState -p Restart -p MainPID -p User 2>/dev/null || true
  echo
  echo "=== 旧服务应已停（避免同名身份冲突）==="
  if systemctl is-active --quiet "${OLD_SERVICE}" 2>/dev/null; then
    echo "  ✗ 旧服务仍在运行 —— 两个同名 runner 会被 GitHub 拒绝" >&2
  else
    echo "  ✓ inactive（符合预期）"
  fi
  echo
  echo "=== 凭据已复用（未重新注册）==="
  if [[ -f /var/lib/github-actions/.runner ]]; then
    echo -n "  agentName: "
    grep -o '"agentName": *"[^"]*"' /var/lib/github-actions/.runner || echo "(解析失败)"
    echo -n "  agentId:   "
    grep -o '"agentId": *[0-9]*' /var/lib/github-actions/.runner || echo "(解析失败)"
  else
    echo "  ✗ 凭据缺失，switch 未完成" >&2
  fi
  echo
  echo "=== 部署目录（/home 被沙箱禁，必须在 /opt）==="
  ls -ld "${NEW_ROOT}"/*/ 2>/dev/null || echo "  未创建（先跑 prepare）"
  echo
  echo "=== GitHub 侧 runner 状态（应为 online）==="
  gh api /orgs/xartifact/actions/runners --jq '.runners[] | select(.name=="x99-arch-server") | {name,status,busy}' 2>/dev/null \
    || echo "  （本机无 gh 或未认证，请在本地执行该命令）"
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
  echo "  注意："
  echo "  - 凭据副本仍在 /var/lib/github-actions/（无害，下次 switch 会覆盖）"
  echo "  - 部署目录如需回退：workflow 的 DEPLOY_DIR 改回 ~/Docker/<repo> 即可"
  echo "    （/opt/xartifact 可保留作备份，或手动删除）"
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
  2. sudo bash migrate-runner.sh dropin     # ReadWritePaths + Restart=always + github-actions 加 docker 组
  3. sudo bash migrate-runner.sh switch     # 复制凭据（复用身份，无需 token）+ 停旧 + 启新
  4. sudo bash migrate-runner.sh verify     # 验证（含同名冲突检测）
  回滚：
     sudo bash migrate-runner.sh rollback

**无需重新注册**：现有凭据（agentId 95 / x99-arch-server）直接复制到包的工作目录。
前提已核实：两版二进制版本一致（均 2.337.0-1）。

⚠ switch 会先停旧 runner —— .runner 里的 agentName 是唯一身份，
  新旧同跑会被 GitHub 拒绝。

随后需改两仓库 workflow 的 DEPLOY_DIR（顺序建议：先 prepare+dropin，再改 workflow，最后 switch）：
  ~/Docker/x-cartographer  →  /opt/xartifact/x-cartographer
  ~/Docker/x-herald        →  /opt/xartifact/x-herald
PLAN
    ;;
esac
