"use strict";
// Point d'entrée unique du moteur de screening partagé (R263).
module.exports = { ...require("./baseline-engine"), ...require("./blocking") };
