#!/usr/bin/env zsh
cd "$(dirname "$0")"

export PATH="/opt/homebrew/opt/node@20/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

./release_auto_mac.sh
status=$?

if [ $status -ne 0 ]; then
  echo
  echo "배포가 실패했습니다. 위 오류 메시지를 확인해 주세요."
  echo "이 창을 닫으려면 Enter를 누르세요."
  read _
  exit $status
fi

echo
echo "배포 요청이 완료되었습니다."
echo "GitHub Actions에서 Windows 설치파일 빌드가 진행됩니다."
echo "이 창을 닫으려면 Enter를 누르세요."
read _
