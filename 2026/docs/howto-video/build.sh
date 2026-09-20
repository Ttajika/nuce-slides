set -e
FF=$(node -e "process.stdout.write(require('ffmpeg-static'))")
node -e '
const l=require("./list.json"); const X=0.6; let args=[], fc="", off=0;
l.forEach((s,i)=>{ args.push("-loop","1","-t",String(s.dur),"-i",s.file); });
l.forEach((s,i)=>{ fc+=`[${i+1}:v]scale=1920:1080,format=yuv420p,fps=30,settb=AVTB[v${i}];`; });
let prev="v0";
for(let i=1;i<l.length;i++){ off+=l[i-1].dur - X; const o=(i===l.length-1)?"vout":`x${i}`; fc+=`[${prev}][v${i}]xfade=transition=fade:duration=${X}:offset=${off.toFixed(3)}[${o}];`; prev=o; }
require("fs").writeFileSync("ff_args.json",JSON.stringify({args,fc:fc.replace(/;$/,"")}));
'
ARGS=$(node -e 'const a=require("./ff_args.json"); process.stdout.write(a.args.join("\n"))')
FC=$(node -e 'const a=require("./ff_args.json"); process.stdout.write(a.fc)')
echo "$ARGS" | tr '\n' '\0' | xargs -0 "$FF" -y -f lavfi -i anullsrc=r=48000:cl=stereo -filter_complex "$FC" -map "[vout]" -map 0:a -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 64k -shortest -movflags +faststart out.mp4
