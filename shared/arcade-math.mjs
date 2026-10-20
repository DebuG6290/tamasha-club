export const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
export const noise=(seed,index)=>{const n=Math.sin(seed*17.17+index*127.1)*43758.5453;return n-Math.floor(n)};
export function ducksAt(seed,elapsed){
  const last=Math.floor(elapsed/850),ducks=[];
  for(let i=Math.max(0,last-5);i<=last;i++){
    const age=elapsed-i*850,duration=2900+noise(seed,i*3)*1400;if(age<0||age>duration)continue;
    const progress=age/duration,right=noise(seed,i*3+1)>.5;
    ducks.push({id:i,x:right?-.1+progress*1.2:1.1-progress*1.2,y:.22+noise(seed,i*3+2)*.50+Math.sin(age/370+i)*.045,right,gold:i%7===6});
  }
  return ducks;
}
export function hitDuck(duck,x,y){return ((duck.x-x)/.048)**2+((duck.y-y)/.09)**2<=1;}
export function obstacleAt(seed,index){return {index,distance:170+index*135,lane:Math.floor(noise(seed,index)*3),type:index%3};}
export function motionOffset(beta,gamma,base,angle=0){
  const wrap=v=>((v+180)%360+360)%360-180,r=angle*Math.PI/180;
  const b=wrap(beta-base.beta),g=wrap(gamma-base.gamma);
  return {x:g*Math.cos(r)+b*Math.sin(r),y:b*Math.cos(r)-g*Math.sin(r)};
}
