#!/usr/bin/env zsh
set -euo pipefail

cd "$(dirname "$0")"

step() {
  printf "\n=== %s ===\n" "$1"
}

fail() {
  printf "\nERROR: %s\n" "$1" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js가 필요합니다. Homebrew node@20 PATH를 확인해 주세요."
command -v npm >/dev/null 2>&1 || fail "npm이 필요합니다."
command -v git >/dev/null 2>&1 || fail "git이 필요합니다."

current_branch="$(git branch --show-current)"
[ -n "$current_branch" ] || fail "현재 git 브랜치를 확인할 수 없습니다."

step "GitHub 푸시 인증 확인"
if ! GIT_TERMINAL_PROMPT=0 git push --dry-run origin "$current_branch" >/dev/null 2>&1; then
  fail "GitHub 푸시 인증이 필요합니다. 먼저 터미널에서 git push origin $current_branch 를 한 번 실행해 GitHub 아이디와 Personal Access Token을 저장하거나, SSH remote를 설정해 주세요."
fi

step "현재 버전 확인"
current_version="$(node -p "require('./package.json').version")"
next_version="$(node - <<'NODE'
const pkg = require('./package.json');
const parts = String(pkg.version || '').split('.').map(Number);
if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n))) {
  throw new Error(`version format must be x.y.z: ${pkg.version}`);
}
parts[2] += 1;
process.stdout.write(parts.join('.'));
NODE
)"
printf "Current version: %s\n" "$current_version"
printf "Next version: %s\n" "$next_version"

step "package.json / package-lock.json 버전 올리기"
npm version "$next_version" --no-git-tag-version

step "변경사항 커밋"
git add --all -- ':!.claude'
git commit -m "Release v$next_version"

step "브랜치 푸시"
git push origin "$current_branch"

step "태그 생성 및 푸시"
if git rev-parse "v$next_version" >/dev/null 2>&1; then
  fail "태그 v$next_version 가 이미 존재합니다."
fi
git tag -a "v$next_version" -m "Release v$next_version"
git push origin "v$next_version"

step "완료"
printf "v%s 태그가 GitHub로 올라갔습니다.\n" "$next_version"
printf "GitHub Actions가 Windows 설치파일을 빌드하고 Release에 업로드합니다.\n"
printf "확인: https://github.com/KoreaUm/teacher-app/actions\n"
