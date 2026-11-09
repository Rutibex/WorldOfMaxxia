import {portraitSetAsset} from './art-production.ts';
/** Final Phase 21 raster portraits and extended native carved SVG command glyphs. */
export function icon(name:string):string{
 const paths:Record<string,string>={
 lockpick:'M10 17V10A8 8 0 0 1 26 10V17M7 17H29V33H7ZM18 22V28M2 10L7 5M3 5L6 8',
 search:'M23 23L33 33M27 15A12 12 0 1 1 3 15A12 12 0 1 1 27 15',
 mug:'M8 9L14 3H23L28 9 23 14Q34 24 27 32H9Q2 24 13 14ZM13 14H23M18 19V28M22 21H16L14 24H21',
 bow:'M7 3Q27 18 7 33M7 3V33M3 18H32M25 12L32 18 25 24',
 sun:'M18 8V2M18 34V28M8 18H2M34 18H28M6 6L10 10M26 26L30 30M30 6L26 10M10 26L6 30M18 11L24 18 18 25 12 18Z',
 camp:'M5 29L18 9 31 29ZM10 29L18 17 26 29M21 6L25 2M26 11L31 8',
 fist:'M10 30L6 22V14L10 12 13 18V8Q16 5 18 8V15 6Q21 3 23 6V16 9Q26 6 28 9V22L23 30Z',
 cross:'M7 6L29 30M29 6L7 30M12 5H24M12 31H24',
 scroll:'M8 6H27L25 11V28Q25 32 30 30H10Q6 30 8 25ZM8 6Q3 4 4 11H8M13 13H23M13 18H22M13 23H20',
 map:'M5 5V31H31M5 12H14V5M14 12V22H22V31M22 5V14H31M5 22H14M22 22H31',
 hourglass:'M7 4H29M7 32H29M10 5Q10 14 18 18 26 23 26 31H10Q10 23 18 18 26 14 26 5M14 10H22M13 28H23',
 party:'M5 11H13V21H5ZM23 11H31V21H23ZM14 5H22V15H14ZM3 31V25H15V31M21 31V25H33V31M12 23V19H24V23',
 swords:'M7 4L27 25M4 7L25 28M5 4L9 5 29 25 25 29 5 9ZM21 25L27 19M28 25L32 29 29 32 25 28M29 4L9 25M32 7L11 28M31 4L27 5 7 25 11 29 31 9ZM15 25L9 19M8 25L4 29 7 32 11 28',
 potion:'M13 3H23V7H21V14L29 24Q34 32 26 33H10Q2 32 7 24L15 14V7H13ZM10 24H26M12 27H20',
 boot:'M12 4H24L22 17 30 23 32 28V32H5V27L11 20ZM12 12H23M9 27H30M17 22L22 23',
 shield:'M18 3L30 8V19Q28 29 18 34 8 29 6 19V8ZM18 8V28M11 12H25',
 gears:'M13 5L16 3 20 5 21 10 26 12 31 11 33 15 30 19 30 24 33 28 30 32 25 30 20 31 17 34 13 31 12 26 7 24 3 25 1 21 5 17 5 12 2 8 6 4 10 6ZM11 18A7 7 0 1 0 25 18A7 7 0 1 0 11 18',
 quick:'M19 2L7 21H17L13 34 30 13H21L25 2Z',
 arrow_up:'M18 4L5 18H13V32H23V18H31Z',
 arrow_down:'M18 32L5 18H13V4H23V18H31Z',
 arrow_left:'M4 18L18 5V13H32V23H18V31Z',
 arrow_right:'M32 18L18 5V13H4V23H18V31Z',
 turn_left:'M5 15L17 4V11H23Q32 11 32 20V31H24V21Q24 18 21 18H17V25Z',
 turn_right:'M31 15L19 4V11H13Q4 11 4 20V31H12V21Q12 18 15 18H19V25Z',

 };
 const d=paths[name]??paths.sun;
 return `<svg viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="#101b22" stroke-width="4" stroke-linejoin="round" transform="translate(0 1)"/><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff0c9" stroke-opacity=".35" stroke-width=".7" transform="translate(-.35 -.45)"/></svg>`;
}
export const CLASS_NAMES=['Myrmidon','Artificer','Mutant','Wizard','Priest','Witch'];
export function portrait(i:number,state:'normal'|'hurt'|'afflicted'|'dead'='normal',id?:string):string{
 const asset=portraitSetAsset(id,i,state)??portraitSetAsset(undefined,0,state)!;
 return `<img class="portrait-raster" src="${asset}" alt="" width="58" height="70" draggable="false">`;
}
