"use strict";
// Point d'entrée unique du moteur de screening partagé (R408).
module.exports = { ...require("./baseline-engine"), ...require("./blocking"), ...require("./ingest") };
