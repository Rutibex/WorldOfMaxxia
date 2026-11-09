/** MM11: deterministic, bounded integer expressions. No eval or arbitrary functions. */
export const AMOUNT_VARIABLES=['LEVEL','PROFICIENCY','STR_MOD','DEX_MOD','CON_MOD','INT_MOD','WIS_MOD','CHA_MOD'] as const;
export type AmountVariable=typeof AMOUNT_VARIABLES[number];
type Node={kind:'number';value:number}|{kind:'variable';name:AmountVariable}|{kind:'dice';count:number;sides:number}|{kind:'unary';operand:Node;negative:boolean}|{kind:'binary';op:'+'|'-'|'*';left:Node;right:Node};
export interface AmountExpression{readonly source:string;readonly tree:Node;readonly maxMagnitude:number;readonly diceRolls:number;}
export class ExpressionError extends Error{constructor(message:string){super(message);this.name='ExpressionError';}}
const TOKEN=/\s*(\d+d\d+|\d+|[A-Z_]+|[()+*\-])/gy;
function lex(source:string):string[]{
 if(typeof source!=='string'||!source.trim()||source.length>120)throw new ExpressionError('Expression must contain 1–120 characters.');
 const tokens:string[]=[];let i=0;
 while(i<source.length){TOKEN.lastIndex=i;const match=TOKEN.exec(source);if(!match){if(/^\s*$/.test(source.slice(i)))break;throw new ExpressionError(`Unexpected token at character ${i+1}.`);}tokens.push(match[1]);i=TOKEN.lastIndex;if(tokens.length>64)throw new ExpressionError('Expression exceeds 64 tokens.');}
 return tokens;
}
/** Parse once at database validation; never consume RNG while parsing. */
export function parseAmountExpression(source:string):AmountExpression{
 const tokens=lex(source);let cursor=0,depth=0;
 const atom=():Node=>{
  if(++depth>12)throw new ExpressionError('Expression is nested too deeply.');
  try{
   const t=tokens[cursor++];if(t===undefined)throw new ExpressionError('Missing expression operand.');
   if(t==='+'||t==='-')return {kind:'unary',negative:t==='-',operand:atom()};
   if(t==='('){const inner=sum();if(tokens[cursor++]!==')')throw new ExpressionError('Unclosed parenthesis.');return inner;}
   if(/^\d+d\d+$/.test(t)){const [count,sides]=t.split('d').map(Number);if(!Number.isInteger(count)||count<1||count>12||![2,4,6,8,10,12,20].includes(sides))throw new ExpressionError('Dice must be 1–12 dice with d2/d4/d6/d8/d10/d12/d20.');return {kind:'dice',count,sides};}
   if(/^\d+$/.test(t)){const value=Number(t);if(!Number.isSafeInteger(value)||value>1000)throw new ExpressionError('Constants must be 0–1000.');return {kind:'number',value};}
   if((AMOUNT_VARIABLES as readonly string[]).includes(t))return {kind:'variable',name:t as AmountVariable};
   throw new ExpressionError(`Unknown variable or operand: ${t}.`);
  }finally{depth--;}
 };
 const product=():Node=>{let node=atom();while(tokens[cursor]==='*'){cursor++;node={kind:'binary',op:'*',left:node,right:atom()};}return node;};
 const sum=():Node=>{let node=product();while(tokens[cursor]==='+'||tokens[cursor]==='-'){const op=tokens[cursor++] as '+'|'-';node={kind:'binary',op,left:node,right:product()};}return node;};
 const tree=sum();if(cursor!==tokens.length)throw new ExpressionError('Unexpected trailing expression token.');
 const estimate=(node:Node):{magnitude:number;rolls:number}=>{
  switch(node.kind){case 'number':return {magnitude:node.value,rolls:0};case 'variable':return {magnitude:Math.max(node.name==='PROFICIENCY'?100:node.name==='LEVEL'?20:20,1),rolls:0};case 'dice':return {magnitude:node.count*node.sides,rolls:node.count};case 'unary':return estimate(node.operand);
   case 'binary':{const a=estimate(node.left),b=estimate(node.right);return {magnitude:node.op==='*'?a.magnitude*b.magnitude:a.magnitude+b.magnitude,rolls:a.rolls+b.rolls};}
  }
 };
 const {magnitude,rolls}=estimate(tree);
 if(!Number.isSafeInteger(magnitude)||magnitude>10000)throw new ExpressionError('Expression may exceed the safe magnitude of 10000.');
 if(rolls>48)throw new ExpressionError('Expression exceeds the 48-roll budget.');
 return {source,tree,maxMagnitude:magnitude,diceRolls:rolls};
}
export function evaluateAmountExpression(expr:AmountExpression,variables:Record<AmountVariable,number>,roll:(min:number,max:number)=>number):number{
 const run=(node:Node):number=>{
  switch(node.kind){case 'number':return node.value;case 'variable':{const v=variables[node.name];if(!Number.isSafeInteger(v)||Math.abs(v)>100)throw new ExpressionError('Invalid expression variable.');return v;}
   case 'dice':{let result=0;for(let n=0;n<node.count;n++)result+=roll(1,node.sides);return result;}
   case 'unary':return node.negative?-run(node.operand):run(node.operand);
   case 'binary':{const a=run(node.left),b=run(node.right);return node.op==='+'?a+b:node.op==='-'?a-b:a*b;}
  }
 };
 const value=run(expr.tree);if(!Number.isSafeInteger(value)||Math.abs(value)>10000)throw new ExpressionError('Calculated amount is out of range.');return value;
}
