// Datos PVPC de ejemplo (€/kWh) usados como fallback / demo.
// En producción se sustituyen por la API de ESIOS/REE vía backend.
export const samplePrices = {
  today: [
    0.118, 0.11, 0.104, 0.099, 0.089, 0.092, 0.101, 0.128, 0.165, 0.158, 0.142,
    0.131, 0.119, 0.108, 0.112, 0.121, 0.134, 0.149, 0.171, 0.198, 0.231, 0.241,
    0.205, 0.162,
  ],
  tomorrow: [
    0.121, 0.112, 0.106, 0.097, 0.091, 0.09, 0.103, 0.135, 0.172, 0.161, 0.138,
    0.125, 0.114, 0.105, 0.109, 0.118, 0.129, 0.146, 0.168, 0.201, 0.238, 0.249,
    0.212, 0.158,
  ],
};

export const appliances = [
  { id: "lavadora", name: "Lavadora", kwh: 1.0, dur: 2 },
  { id: "lavavajillas", name: "Lavavajillas", kwh: 1.2, dur: 3 },
  { id: "secadora", name: "Secadora", kwh: 2.5, dur: 2 },
  { id: "horno", name: "Horno", kwh: 1.5, dur: 1 },
  { id: "termo", name: "Termo agua", kwh: 2.0, dur: 3 },
  { id: "coche", name: "Coche eléct.", kwh: 7.0, dur: 4 },
] as const;
