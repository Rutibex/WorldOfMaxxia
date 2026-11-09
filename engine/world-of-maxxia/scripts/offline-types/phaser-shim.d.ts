/** Compile-only stand-in when Phaser's npm type declarations cannot be installed.
 * Does not validate Phaser API signatures. Do not ship or import in the normal Vite build. */
declare namespace Phaser {
  class Scene {
    constructor(config?:unknown);
    load:any;cache:any;scene:any;textures:any;add:any;time:any;events:any;
  }
  namespace Textures {type CanvasTexture=any;}
  class Game {
    constructor(config:any);
    renderer:{type:number};canvas:HTMLCanvasElement;loop:{stop():void};
  }
  const AUTO:number;const WEBGL:number;
  namespace Scale {const FIT:number;const CENTER_BOTH:number;}
}
declare module 'phaser' {export = Phaser;}
interface ImportMeta {env:{BASE_URL:string}}
