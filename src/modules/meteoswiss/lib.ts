import {combine2, combine3} from '/jslib/js/promise.js';

/**
 * Class that gets data from meteo swiss stations.
 * It is adjusted for Zurich and Adliswil
 */
export class MeteoSwissLib {
  static #maxAltitude = 600;
  #minX;
  #maxX;
  #minY;
  #maxY;
  #minXRain;
  #maxXRain;
  #minYRain;
  #maxYRain;

  /**
   * @param {number} workY
   * @param {number} workX
   * @param {number} homeY
   * @param {number} homeX
   * @param {number} dist Search stations within distance from home and work (meters)
   */
  constructor(workY, workX, homeY, homeX, dist = 12000) {
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
    this.#minYRain = this.#minY - 2*dist;
    this.#maxYRain = this.#maxY;
  }

  /**
   * @return {Promise<string>}
   */
  getTemperature() {
    return this.#fetchAndGetAverage('https://data.geo.admin.ch/ch.meteoschweiz.messwerte-lufttemperatur-10min/ch.meteoschweiz.messwerte-lufttemperatur-10min_en.json');
  }

  /**
   * @return {Promise<string>}
   */
  getHumidity() {
    return this.#fetchAndGetAverage('https://data.geo.admin.ch/ch.meteoschweiz.messwerte-luftfeuchtigkeit-10min/ch.meteoschweiz.messwerte-luftfeuchtigkeit-10min_en.json');
  }

  /**
   * @return {Promise<string>}
   */
  getWind() {
    return this.#fetchAndGetAverage('https://data.geo.admin.ch/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min/ch.meteoschweiz.messwerte-windgeschwindigkeit-kmh-10min_en.json');
  }

  /**
   * @return {Promise<boolean>}
   */
  isRaining() {
    const url = 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-niederschlag-10min/ch.meteoschweiz.messwerte-niederschlag-10min_en.json';
    const featuresPromise = this.#fetchFeatures(url)
        .then((features) => features
            .filter(this.#filterAltitude.bind(this))
            .filter(this.#filterInactive.bind(this))
            .filter(this.#filterLocationRain.bind(this)));

    /** @type{Promise<boolean>} */
    const resultPromise = featuresPromise.then((features) => features.some((f) => f.properties.value > 0));

    return combine2(featuresPromise, resultPromise, (features, result) => {
      console.groupCollapsed('IsRaining: ' + result);
      features.forEach((f) => console.debug('%f%s\t%s [%fm]', f.properties.value, f.properties.unit, f.properties.station_name, f.properties.altitude));
      console.groupEnd();
      return result;
    });
  }

  /**
   * @param {string} url
   * @return {Promise<string>}
   */
  #fetchAndGetAverage(url) {
    const featuresPromise = this.#fetchFeatures(url)
        .then((features) => features
            .filter(this.#filterAltitude.bind(this))
            .filter(this.#filterInactive.bind(this))
            .filter(this.#filterLocation.bind(this)));

    /** @type {Promise<string>} */
    const resultPromise = featuresPromise.then(
        (features) => features.length > 0 ?
            (features
                .map((f) => f.properties.value)
                .reduce((partialSum, a) => partialSum + a, 0) / features.length)
                .toFixed(1) :
            '0');

    /** @type {Promise<string>} */
    const unitPromise = featuresPromise.then(
        (features) => features.find((f) => f.properties.unit)?.properties.unit || '');

    return combine3(featuresPromise, resultPromise, unitPromise, (features, result, unit) => {
      console.groupCollapsed(`GetAverage: ${result}${unit}`);
      features.forEach((f) => console.debug('%f%s\t%s [%fm]', f.properties.value, f.properties.unit, f.properties.station_name, f.properties.altitude)); console.groupEnd();
      return `${result}${unit}`;
    });
  }

  /**
   * @param {string} url
   * @return {Promise<Object[]>}
   */
  #fetchFeatures(url) {
    return fetch(url)
        .then((response) => {
          if (response.status != 200) {
            throw new Error('Cannot fetch.');
          }
          return response.json();
        })
        .then((jsonResponse) => jsonResponse.features);
  }

  /**
   * @param {object} feature
   * @return {boolean}
   */
  #filterInactive(feature) {
    return feature.properties.reference_ts &&
      feature.properties.reference_ts != 'null' &&
      feature.properties.reference_ts != '-';
  }

  /**
   * @param {object} feature
   * @return {boolean}
   */
  #filterLocationRain(feature) {
    return this.#filterLocationInternal(feature, this.#minXRain, this.#maxXRain, this.#minYRain, this.#maxYRain);
  }

  /**
   * @param {object} feature
   * @return {boolean}
   */
  #filterLocation(feature) {
    return this.#filterLocationInternal(feature, this.#minX, this.#maxX, this.#minY, this.#maxY);
  }

  /**
   * @param {object} feature
   * @return {boolean}
   */
  #filterAltitude(feature) {
    return feature.properties.altitude && feature.properties.altitude <= MeteoSwissLib.#maxAltitude;
  }

  /**
   * @param {object} feature
   * @param {number} minX
   * @param {number} maxX
   * @param {number} minY
   * @param {number} maxY
   * @return {boolean}
   */
  #filterLocationInternal(feature, minX, maxX, minY, maxY) {
    return feature.geometry.coordinates[0] >= minY &&
        feature.geometry.coordinates[0] <= maxY &&
        feature.geometry.coordinates[1] >= minX &&
        feature.geometry.coordinates[1] <= maxX;
  }
}
