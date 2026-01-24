import {combine} from '../../lib/promise';

interface Geometry {
  coordinates: [number, number];
}

interface Properties {
  value: number;
  unit: string;
  station_name: string;
  altitude: number;
  reference_ts: string | null;
}

interface Feature {
  geometry: Geometry;
  properties: Properties;
}

interface JsonResponse {
  features: Feature[];
}

/**
 * Class that gets data from meteo swiss stations.
 * It is adjusted for Zurich and Adliswil
 */
export class MeteoSwissLib {
  private static readonly maxAltitude = 600;
  readonly #minX: number;
  readonly #maxX: number;
  readonly #minY: number;
  readonly #maxY: number;
  readonly #minXRain: number;
  readonly #maxXRain: number;
  readonly #minYRain: number;
  readonly #maxYRain: number;

  constructor(workY: number, workX: number, homeY: number, homeX: number, dist = 12000) {
    console.log('MeteoSwissLib created');

    // CH1903+ coordinates have reversed X and Y, so they are noted as (Y,X) on a cartesian chart.
    // They are always positive:
    //
    //   ^
    //   |
    //   |            Work(Y,X)
    // X |
    //   |         Home(Y,X)
    //   |
    //   +----------------------------->
    //                 Y

    this.#minX = Math.min(workX, homeX) - dist;
    this.#maxX = Math.max(workX, homeX) + dist;
    this.#minY = Math.min(workY, homeY) - dist;
    this.#maxY = Math.max(workY, homeY) + dist;

    // Decrease minY (==extend borders) as the rain usually comes from the west
    this.#minXRain = this.#minX;
    this.#maxXRain = this.#maxX;
    this.#minYRain = this.#minY - 2 * dist;
    this.#maxYRain = this.#maxY;
  }

  getTemperature(): Promise<string> {
    return this.#fetchAndGetAverage(
      'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-lufttemperatur-10min/ch.meteoschweiz.messwerte-lufttemperatur-10min_en.json',
    );
  }

  getHumidity(): Promise<string> {
    return this.#fetchAndGetAverage(
      'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-luftfeuchtigkeit-10min/ch.meteoschweiz.messwerte-luftfeuchtigkeit-10min_en.json',
    );
  }

  getWind(): Promise<string> {
    return this.#fetchAndGetAverage(
      'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min_en.json',
    );
  }

  isRaining(): Promise<boolean> {
    const url =
      'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-niederschlag-10min/ch.meteoschweiz.messwerte-niederschlag-10min_en.json';
    const featuresPromise = this.#fetchFeatures(url).then((features) =>
      features
        .filter((feature) => this.#filterAltitude(feature))
        .filter((feature) => this.#filterInactive(feature))
        .filter((feature) => this.#filterLocationRain(feature)),
    );

    const resultPromise: Promise<boolean> = featuresPromise.then((features) =>
      features.some((f) => f.properties.value > 0),
    );

    return combine(featuresPromise, resultPromise, (features, result) => {
      console.groupCollapsed('IsRaining: ' + result);
      features.forEach((f) =>
        console.debug(
          '%f%s\t%s [%fm]',
          f.properties.value,
          f.properties.unit,
          f.properties.station_name,
          f.properties.altitude,
        ),
      );
      console.groupEnd();
      return result;
    });
  }

  #fetchAndGetAverage(url: string): Promise<string> {
    const featuresPromise: Promise<Feature[]> = this.#fetchFeatures(url).then((features) =>
      features
        .filter((feature) => this.#filterAltitude(feature))
        .filter((feature) => this.#filterInactive(feature))
        .filter((feature) => this.#filterLocation(feature)),
    );

    const resultPromise: Promise<string> = featuresPromise.then((features) =>
      features.length > 0
        ? (
            features.map((f) => f.properties.value).reduce((partialSum, a) => partialSum + a, 0) / features.length
          ).toFixed(1)
        : '0',
    );

    const unitPromise: Promise<string> = featuresPromise.then(
      (features) => features.find((f) => f.properties.unit)?.properties.unit || '',
    );

    return combine(featuresPromise, resultPromise, unitPromise, (features, result, unit) => {
      console.groupCollapsed(`GetAverage: ${result}${unit}`);
      features.forEach((f) =>
        console.debug(
          '%f%s\t%s [%fm]',
          f.properties.value,
          f.properties.unit,
          f.properties.station_name,
          f.properties.altitude,
        ),
      );
      console.groupEnd();
      return `${result}${unit}`;
    });
  }

  async #fetchFeatures(url: string): Promise<Feature[]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Cannot fetch: ${response.statusText}`);
    }
    const jsonResponse: JsonResponse = await response.json();
    return jsonResponse.features;
  }

  #filterInactive(feature: Feature): boolean {
    return (
      feature.properties.reference_ts != null &&
      feature.properties.reference_ts !== 'null' &&
      feature.properties.reference_ts !== '-'
    );
  }

  #filterLocationRain(feature: Feature): boolean {
    return this.#filterLocationInternal(feature, this.#minXRain, this.#maxXRain, this.#minYRain, this.#maxYRain);
  }

  #filterLocation(feature: Feature): boolean {
    return this.#filterLocationInternal(feature, this.#minX, this.#maxX, this.#minY, this.#maxY);
  }

  #filterAltitude(feature: Feature): boolean {
    return feature.properties.altitude != null && feature.properties.altitude <= MeteoSwissLib.maxAltitude;
  }

  #filterLocationInternal(feature: Feature, minX: number, maxX: number, minY: number, maxY: number): boolean {
    const [y, x] = feature.geometry.coordinates;
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }
}
