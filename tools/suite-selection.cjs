const fs=require('node:fs');
const path=require('node:path');
function selectSuites(root,{requireIntegrations=false}={}) {
 const available=fs.existsSync(path.join(root,'examples/railcore/vcts.config.json'));
 const unavailable=available ? [] : [
  {name:'railcore',reason:'Отсутствуют исходники examples/railcore'},
  {name:'project-external-api',reason:'Для примера нужен собранный examples/railcore'},
 ];
 if(requireIntegrations && unavailable.length)throw new Error(unavailable.map(item=>item.reason).join('\n'));
 return {railcore:available,unavailable};
}
module.exports={selectSuites};
