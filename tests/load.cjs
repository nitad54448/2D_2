const path=require('node:path');for(const name of ['materials','fourier','mesh2d','sparse','solver2d','validation','config2d'])require(path.join(__dirname,'../src/core',name+'.js'));module.exports=globalThis.TE;

require('../src/equations.js');
