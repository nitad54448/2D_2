(function(TE){
class Mesh2D {
 constructor({nx,ny,lx,ly,depth=1,materialMap}) {
  TE.assert(Number.isInteger(nx)&&Number.isInteger(ny)&&nx>=2&&ny>=1,'Use at least 2 cells along x and 1 along y.');
  TE.assert((nx+1)*(ny+1)<=1600,'Maximum 1600 nodes in this browser version.');
  TE.assert([lx,ly,depth].every(v=>Number.isFinite(v)&&v>0),'Dimensions and depth must be positive.');
  Object.assign(this,{nx,ny,lx,ly,depth});this.dx=lx/nx;this.dy=ly/ny;this.n=(nx+1)*(ny+1);
  this.map=materialMap??Array(nx*ny).fill(0);TE.assert(this.map.length===nx*ny,'Material map size does not match the grid.');
  this.x=[];this.y=[];this.cells=[];this.links=[];this.volumes=Array(this.n).fill(0);
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){this.x.push(i*this.dx);this.y.push(j*this.dy);}
  const volume=this.dx*this.dy*depth;
  TE.assert([volume/4,this.dx*depth/2,this.dy*depth/2].every(v=>Number.isFinite(v)&&v>0),'Dimensions produce zero or overflowing volumes/areas.');
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1,id=j*nx+i,m=this.map[id];
   const nodes=[a,b,c,d];nodes.forEach(n=>this.volumes[n]+=volume/4);
   const first=this.links.length;
   this.links.push({a,b,m,A:this.dy*depth/2,L:this.dx,axis:0,cell:id},{a:c,b:d,m,A:this.dy*depth/2,L:this.dx,axis:0,cell:id},
    {a,b:c,m,A:this.dx*depth/2,L:this.dy,axis:1,cell:id},{a:b,b:d,m,A:this.dx*depth/2,L:this.dy,axis:1,cell:id});
   this.cells.push({nodes,m,volume,links:[first,first+1,first+2,first+3]});
  }
  this.sides={left:[],right:[],bottom:[],top:[]};
  for(let j=0;j<=ny;j++){const A=this.dy*depth*(j===0||j===ny?.5:1);this.sides.left.push({node:j*(nx+1),A,u:j/ny});this.sides.right.push({node:j*(nx+1)+nx,A,u:j/ny});}
  for(let i=0;i<=nx;i++){const A=this.dx*depth*(i===0||i===nx?.5:1);this.sides.bottom.push({node:i,A,u:i/nx});this.sides.top.push({node:ny*(nx+1)+i,A,u:i/nx});}
 }
 electrode(side,range=[0,1]) {
  TE.assert(this.sides[side]&&range.length===2&&range.every(Number.isFinite)&&range[0]>=0&&range[1]<=1&&range[1]>range[0],'Invalid electrode side/range.');
  const nodes=this.sides[side].filter(f=>f.u>=range[0]-1e-12&&f.u<=range[1]+1e-12).map(f=>f.node);
  TE.assert(nodes.length>=2,'Each electrode needs at least two boundary nodes. Refine the grid or increase coverage.');return nodes;
 }
}
TE.Mesh2D=Mesh2D;
})(globalThis.TE);
