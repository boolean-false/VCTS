const fs=require('node:fs');
const path=require('node:path');
const directory=path.resolve(__dirname,'../tests/fixtures');
function available(){return fs.existsSync(directory);}
function requireFixtures(){
  if(!available()){
    console.log('Пропуск: для этой проверки нужны локальные сценарии tests/fixtures, которые не входят в поставку.');
    process.exit(0);
  }
}
module.exports={available,requireFixtures};
