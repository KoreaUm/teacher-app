#!/bin/zsh

export PATH="/opt/homebrew/opt/node@20/bin:/usr/local/opt/node@20/bin:$PATH"

cd /Users/jake/Desktop/teacher-app || {
  echo "teacher-app 폴더로 이동하지 못했습니다: /Users/jake/Desktop/teacher-app"
  echo
  read -r "REPLY?엔터 키를 누르면 종료합니다... "
  exit 1
}

echo "teacher-app 개발 앱을 실행합니다..."
echo "작업 폴더: $(pwd)"
echo

npm start
status=$?

echo
if [ "$status" -ne 0 ]; then
  echo "npm start 실행 중 오류가 발생했습니다. 종료 코드: $status"
else
  echo "npm start가 종료되었습니다. 종료 코드: $status"
fi

echo
read -r "REPLY?메시지를 확인한 뒤 엔터 키를 누르면 종료합니다... "
exit "$status"
