const B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAAEAAAAAA0VXHyAAABoElEQVQ4EX2Tz0rDQBDGv022VRShjVgKBfHkRRAveujZmz6CPoEPI4hvIlLxCRQ9elIEPbQVvUhbbJs2WWd2d5L+0e4h+XbmN19msokqbdSMgoJdfDNekjZe27Rol/aQgQ6UL5aE3zIvqTktLDkHmfZCHiS23IXoWZb32oyHc3FrogKosJB1IdCkGZvr5e1jyeV3Kk56H4ibD9ZEXKaKmaaA1pWdvFCUSVHcrCMobaH/3IBKY+sh49kXzW7cQdJtOcXFFGBIBQUEKxFqR2cY7O6jdXWOlDilbNZBzBOtqgcnHHUnZRVtaPbq4SlCFXMKo58+vu5vgWREID3acg7WDGSzkXCdUZLekEPoKucpoOUcqcPVirdg3JfTCN+vb1jfq2Pwfod24wJpp+lGoM9OZuAPUAdrNQrMrpQaUGhfX6L/cgOkQwS6SBAX54t3evz5lEdEqRBpr4249eiOcaZQML6rKKq4USejPD2Z8MtctGwH0EuLmH9zxv5p9l/4owFfNj1x7sXFUbmMMAyRHyPTmZds5EfPEs6FjrXT7cKkCX4Bd9p/Q/wzRpIAAAAASUVORK5CYII=';

function decode(s: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64');
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

/** 16x16 PNG favicon decoded from an embedded base64 string. */
export const FAVICON_PNG: Uint8Array = decode(B64);
