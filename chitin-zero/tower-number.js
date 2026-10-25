(function(root){
  'use strict';
  // Positive logarithmic quantities keep endless enemy HP and combo damage finite.
  class Value{
    constructor(log=-Infinity){this.log=Number.isFinite(log)?log:-Infinity;}
    static of(n){return n instanceof Value?n:new Value(Number.isFinite(n)&&n>0?Math.log10(n):-Infinity);}
    static pow(base,exponent){return new Value(Math.log10(base)*exponent);}
    add(n){const b=Value.of(n),hi=Math.max(this.log,b.log),lo=Math.min(this.log,b.log);return new Value(hi===-Infinity||hi-lo>16?hi:hi+Math.log10(1+10**(lo-hi)));}
    sub(n){const b=Value.of(n);return new Value(this.log<=b.log?-Infinity:this.log-b.log>16?this.log:this.log+Math.log10(1-10**(b.log-this.log)));}
    mul(n){return new Value(this.log+Value.of(n).log);}
    ratio(n){const b=Value.of(n);return this.log===-Infinity||b.log===-Infinity?0:Math.min(1,10**Math.min(0,this.log-b.log));}
    format(){if(this.log===-Infinity)return'0';if(this.log<6)return(10**this.log).toLocaleString('ru-RU',{maximumFractionDigits:this.log<1?1:0});const e=Math.floor(this.log);return`${(10**(this.log-e)).toFixed(2)}e${e}`;}
    toJSON(){return this.log===-Infinity?null:this.log;}
  }
  root.TowerNumber=Value;if(typeof module!=='undefined'&&module.exports)module.exports=Value;
})(typeof globalThis!=='undefined'?globalThis:this);
