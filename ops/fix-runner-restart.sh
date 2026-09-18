#!/usr/bin/env bash
#
# 修复 GitHub Actions 自托管 runner 的 Restart=no（2026-09-15 事故根因）
#
# 事故回顾：x99-arch-server 的 runner 服务 Restart=no，进程 09-09 被杀后永久静默离线。
# 组织内 self-hosted job 排队无上限，导致 x-herald / x-cartographer 的部署 job
# 排队 24h 后超时（详见 AGENTS.md 与 2026-09-15 诊断记录）。
#
# 本脚本：
#   1. 用 systemd drop-in 覆盖 Restart=always（不改官方 unit 文件，便于升级 runner 时保留）
#   2. 校验 override 生效
#   3. 重启服务并确认进程存活
#   4. 打印验证结论
#
# 用法：在 x99-arch-server 上执行
#   sudo bash fix-runner-restart.sh
# 回滚：
#   sudo rm -rf /etc/systemd/system/actions.runner.xartifact.x99-arch-server.service.d
#   sudo systemctl daemon-reload && sudo systemctl restart actions.runner.xartifact.x99-arch-server.service
#
set -euo pipefail

SERVICE="actions.runner.xartifact.x99-arch-server.service"
DROPIN_DIR="/etc/systemd/system/${SERVICE}.d"
DROPIN_FILE="${DROPIN_DIR}/restart.conf"

# ── 前置检查 ──────────────────────────────────────────────
if [[ "${EUID}" -ne 0 ]]; then
  echo "✗ 需要 root 权限（sudo bash $0）" >&2
  exit 1
fi

if ! systemctl list-unit-files | grep -q "^${SERVICE}"; then
  echo "✗ 未找到服务 ${SERVICE}" >&2
  echo "  可用 runner 服务：" >&2
  systemctl list-unit-files | grep -i 'actions.runner' >&2 || echo "  （无）" >&2
  exit 1
fi

echo "=== 修复前 ==="
systemctl show "${SERVICE}" -p Restart -p RestartSec -p ActiveState -p MainPID

# ── 写入 drop-in ─────────────────────────────────────────
echo
echo "=== 写入 drop-in: ${DROPIN_FILE} ==="
mkdir -p "${DROPIN_DIR}"
cat > "${DROPIN_FILE}" <<'EOF'
# GitHub Actions 自托管 runner：崩溃/被杀后自动重启。
# 默认 unit 是 Restart=no —— 进程一旦退出就永久离线且无告警，
# 会让 self-hosted job 无声排队（2026-09-15 事故）。
[Service]
Restart=always
RestartSec=10
EOF
cat "${DROPIN_FILE}"

# ── 应用并重启 ───────────────────────────────────────────
echo
echo "=== daemon-reload + restart ==="
systemctl daemon-reload
systemctl restart "${SERVICE}"

# 等待服务进入 active（runner 启动需数秒）
echo -n "等待服务就绪"
for _ in $(seq 1 20); do
  if systemctl is-active --quiet "${SERVICE}"; then break; fi
  echo -n "."
  sleep 1
done
echo

# ── 验证 ─────────────────────────────────────────────────
echo
echo "=== 修复后 ==="
systemctl show "${SERVICE}" -p Restart -p RestartSec -p ActiveState -p MainPID -p NRestarts

RESTART_VAL="$(systemctl show "${SERVICE}" -p Restart --value)"
ACTIVE_VAL="$(systemctl show "${SERVICE}" -p ActiveState --value)"
MAINPID_VAL="$(systemctl show "${SERVICE}" -p MainPID --value)"

echo
if [[ "${RESTART_VAL}" == "always" && "${ACTIVE_VAL}" == "active" && "${MAINPID_VAL}" != "0" ]]; then
  echo "✓ PASS —— Restart=always 已生效，服务 active（PID ${MAINPID_VAL}）"
else
  echo "✗ FAIL —— Restart=${RESTART_VAL} ActiveState=${ACTIVE_VAL} MainPID=${MAINPID_VAL}" >&2
  echo "  排查：journalctl -u ${SERVICE} -n 50" >&2
  exit 1
fi

# ── runner 是否已向 GitHub 注册 ──────────────────────────
echo
echo "=== runner 注册状态（最近日志）==="
journalctl -u "${SERVICE}" -n 15 --no-pager | grep -iE 'listening|runner|connect' || true

echo
echo "提示：GitHub 侧确认 runner 在线："
echo "  gh api /orgs/xartifact/actions/runners --jq '.runners[] | select(.name==\"x99-arch-server\") | {name, status, busy}'"
echo
echo "回滚命令："
echo "  sudo rm -rf ${DROPIN_DIR} && sudo systemctl daemon-reload && sudo systemctl restart ${SERVICE}"
