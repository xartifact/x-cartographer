#!/usr/bin/env bash
#
# 清理旧手动安装 runner 的遗留物（迁移到 AUR 包后）
#
# 背景：runner 已从手动安装（~/runner-new）迁移到 AUR 包 github-actions-bin。
# 目录已被手动删除，但 /etc/systemd/system/ 下的旧 unit 文件仍在，
# 且 ExecStart 指向已不存在的 runsvc.sh（悬空引用）。
#
# 本脚本只清理 unit 文件，不碰：
#   - /opt/xartifact/（新部署目录）
#   - /var/lib/github-actions/（新 runner）
#   - ~/Docker/（旧部署目录，保留作备份）
#
# 用法：sudo bash cleanup-old-runner.sh [--dry-run]
#
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

OLD_SERVICE="actions.runner.xartifact.x99-arch-server.service"
OLD_UNIT="/etc/systemd/system/${OLD_SERVICE}"
OLD_RUNNER_DIR="/home/binzhan/runner-new"

if [[ "${EUID}" -ne 0 ]]; then
  echo "✗ 需要 root（sudo bash $0）" >&2
  exit 1
fi

echo "=== 前置检查：新 runner 必须在正常运行 ==="
NEW_STATE="$(systemctl show github-actions.service -p ActiveState --value 2>/dev/null || echo unknown)"
NEW_PID="$(systemctl show github-actions.service -p MainPID --value 2>/dev/null || echo 0)"
if [[ "${NEW_STATE}" != "active" || "${NEW_PID}" == "0" ]]; then
  echo "✗ 新 runner 未运行（ActiveState=${NEW_STATE} MainPID=${NEW_PID}）" >&2
  echo "  拒绝清理：先确保新 runner 正常，否则会失去 CI 能力。" >&2
  exit 1
fi
echo "  ✓ github-actions.service active (PID ${NEW_PID})"

echo
echo "=== 待清理项 ==="
if [[ -f "${OLD_UNIT}" ]]; then
  echo "  unit 文件: ${OLD_UNIT}"
  grep -E '^ExecStart=' "${OLD_UNIT}" | sed 's/^/    /'
  # 确认它确实悬空
  EXEC_PATH="$(grep -oP '(?<=^ExecStart=)\S+' "${OLD_UNIT}" || true)"
  if [[ -n "${EXEC_PATH}" && ! -e "${EXEC_PATH}" ]]; then
    echo "    ⚠ ExecStart 指向不存在的文件（悬空引用，确认可删）"
  fi
else
  echo "  unit 文件: 不存在（已清理）"
fi
[[ -d "${OLD_RUNNER_DIR}" ]] && echo "  目录: ${OLD_RUNNER_DIR}（仍存在）" || echo "  目录: ${OLD_RUNNER_DIR}（已删除）"

if [[ "${DRY_RUN}" == true ]]; then
  echo
  echo "[DRY-RUN] 未执行任何修改"
  exit 0
fi

echo
echo "=== 执行清理 ==="
if systemctl list-unit-files | grep -q "^${OLD_SERVICE}"; then
  systemctl disable "${OLD_SERVICE}" 2>/dev/null || true
  systemctl reset-failed "${OLD_SERVICE}" 2>/dev/null || true
  echo "  ✓ 已 disable + reset-failed"
fi
if [[ -f "${OLD_UNIT}" ]]; then
  rm -f "${OLD_UNIT}"
  echo "  ✓ 已删除 ${OLD_UNIT}"
fi
systemctl daemon-reload
echo "  ✓ daemon-reload"

echo
echo "=== 验证 ==="
if systemctl list-unit-files | grep -q "^${OLD_SERVICE}"; then
  echo "  ✗ unit 仍存在" >&2
  exit 1
fi
echo "  ✓ 旧 unit 已移除"
echo
echo "=== 残留的 runner 单元（应只剩包提供的）==="
systemctl list-unit-files | grep -i 'actions.runner\|github-actions' || echo "  （无）"
echo
echo "=== 当前 runner 状态 ==="
systemctl show github-actions.service -p ActiveState -p MainPID -p Restart
echo
echo "提示：/opt/xartifact/（新部署目录）与 ~/Docker/（旧备份）均未触碰。"
echo "      ~/Docker/ 确认无用的可自行删除。"
