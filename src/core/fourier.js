(function (TE) {
  // Peak phasors: u(t)=U0+Re(sum(Un*exp(i*n*omega*t))).
  TE.extractHarmonics = (history, count=3) => {
    const n=history.length, scalar=typeof history[0]==='number';
    TE.assert(Number.isInteger(count)&&count>=0&&n>2*count,'Too few samples for requested harmonics.');
    const data=scalar?history.map(v=>[v]):history, width=data[0].length;
    return Array.from({length:count+1},(_,k)=> {
      const row=Array.from({length:width},()=>({re:0,im:0}));
      for(let i=0;i<n;i++) {const a=2*Math.PI*k*i/n, scale=(k?2:1)/n; for(let j=0;j<width;j++) {row[j].re+=data[i][j]*Math.cos(a)*scale; row[j].im-=data[i][j]*Math.sin(a)*scale;}}
      return scalar?row[0]:row;
    });
  };
})(globalThis.TE);
