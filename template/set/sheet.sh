#!/bin/sh
# 拼图自检，在 set/ 里跑。用法：
#   sh sheet.sh levels 输出.jpg 秒 "附加参数" 级别…      同一时刻、同一机位，每个级别一帧，拼成一行。看光、材质、阴影一层层加上去的样子
#   sh sheet.sh views  输出.jpg 秒 "附加参数" 机位名…    同一时刻换几个固定机位（shots.js 里 CAMS 的名字），拼成一行
# 例：sh sheet.sh levels ../out/check/lv.jpg 20 "cam=wide&clean" 0 1 2 3 4 5 6 7
#     sh sheet.sh views ../out/check/clay.jpg 0 "clay=1&clean" wide talk board side top
mode=$1; out=$2; t=$3; q=$4; shift 4; d=$(mktemp -d); i=0
for x in "$@"; do
  if [ "$mode" = levels ]; then qq="level=$x&$q"; else qq="cam=$x&$q"; fi
  node render.mjs --page film.html --size 1280x720 --sheet "$t" --cols 1 --w 1280 --q "$qq" --out "$d/$(printf %02d $i).jpg" >/dev/null || echo "$x 渲不出来"; i=$((i+1))
done
n=$i; cols=${COLS:-4}; [ "$n" -lt "$cols" ] && cols=$n; rows=$(( (n + cols - 1) / cols ))
mkdir -p "$(dirname "$out")"
ffmpeg -y -loglevel error -framerate 1 -i "$d/%02d.jpg" -vf "scale=${W:-800}:-1,tile=${cols}x${rows}" -frames:v 1 "$out" && echo "wrote $out"; rm -rf "$d"
