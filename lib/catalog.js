// Generated from lib/*.json by build_catalog.py; do not edit directly.
globalThis.TE_MATERIAL_CATALOG = {
  "Aluminum.json": {
    "format": "TE_2D_material",
    "version": 1,
    "referenceTemperature": 300,
    "units": {
      "rho": "kg/m^3",
      "Cp": "J/(kg K)",
      "k": "W/(m K)",
      "sigma": "S/m",
      "alpha": "V/K",
      "beta": "1/K",
      "alphaSlope": "V/K^2"
    },
    "material": {
      "name": "Aluminum",
      "rho": 2700,
      "Cp": 897,
      "k": 237,
      "sigma": 37735849.056603774,
      "alpha": -1.7e-06,
      "beta": 0,
      "alphaSlope": 0,
      "color": "#96b8d5"
    },
    "notes": "Room-temperature bulk approximation: supplier thermal/density data and 293.15 K conductivity used unchanged at nominal 300 K. beta=0 and alphaSlope=0 deliberately assume constant transport coefficients; select Custom to supply measured slopes.",
    "sources": [
      {
        "url": "https://www.goodfellow.com/global/material/metals/aluminium",
        "properties": "rho, Cp, k, resistivity"
      },
      {
        "url": "https://patents.google.com/patent/US8696989B2/en",
        "properties": "Table 1: representative Seebeck coefficient."
      }
    ]
  },
  "Bi2Te3.json": {
    "format": "TE_2D_material",
    "version": 1,
    "referenceTemperature": 300,
    "units": {
      "rho": "kg/m^3",
      "Cp": "J/(kg K)",
      "k": "W/(m K)",
      "sigma": "S/m",
      "alpha": "V/K",
      "beta": "1/K",
      "alphaSlope": "V/K^2"
    },
    "material": {
      "name": "Bi2Te3 (p-type benchmark)",
      "rho": 7740,
      "Cp": 154.4,
      "k": 1.6,
      "sigma": 110000.0,
      "alpha": 0.0002,
      "beta": 0,
      "alphaSlope": 0,
      "color": "#73d8d0"
    },
    "notes": "Constant-property COMSOL thermoelectric-leg benchmark, used at nominal 300 K. Positive Seebeck denotes this p-type model. beta=0 and alphaSlope=0 are constant-property assumptions. Real Bi2Te3 depends on doping and orientation; not a universal bulk standard.",
    "sources": [
      {
        "url": "https://doc.comsol.com/6.3/doc/com.comsol.help.models.heat.thermoelectric_leg/thermoelectric_leg.html",
        "properties": "All five scalar properties from Table 1; zero slopes are modeling assumptions."
      }
    ]
  },
  "Bi2Te3_n_type.json": {
    "format": "TE_2D_material",
    "version": 1,
    "referenceTemperature": 300,
    "units": {
      "rho": "kg/m^3",
      "Cp": "J/(kg K)",
      "k": "W/(m K)",
      "sigma": "S/m",
      "alpha": "V/K",
      "beta": "1/K",
      "alphaSlope": "V/K^2"
    },
    "material": {
      "name": "Bi2Te3 n-type (illustrative)",
      "rho": 7740,
      "Cp": 154.4,
      "k": 1.6,
      "sigma": 110000.0,
      "alpha": -0.0002,
      "beta": 0,
      "alphaSlope": 0,
      "color": "#ae92d9"
    },
    "notes": "Illustrative n-type partner: same scalar properties as the p-type benchmark with ONLY the Seebeck sign reversed. This is a constructed demonstration preset, not measured n-type material data. Both slopes are zero.",
    "sources": [
      {
        "url": "https://doc.comsol.com/6.3/doc/com.comsol.help.models.heat.thermoelectric_leg/thermoelectric_leg.html",
        "properties": "Positive-Seebeck benchmark is the starting point; the negative Seebeck sign is an explicit modeling assumption."
      }
    ]
  },
  "Copper.json": {
    "format": "TE_2D_material",
    "version": 1,
    "referenceTemperature": 300,
    "units": {
      "rho": "kg/m^3",
      "Cp": "J/(kg K)",
      "k": "W/(m K)",
      "sigma": "S/m",
      "alpha": "V/K",
      "beta": "1/K",
      "alphaSlope": "V/K^2"
    },
    "material": {
      "name": "Copper",
      "rho": 8960,
      "Cp": 385,
      "k": 401,
      "sigma": 57478566.4581124,
      "alpha": 1.83e-06,
      "beta": 0.004176967424511028,
      "alphaSlope": 0,
      "color": "#edaf6e"
    },
    "notes": "Approximate bulk room-temperature preset. Supplier resistivity at 293.15 K and tabulated temperature coefficient are treated as a local linear law and rebased to 300 K. Density, Cp and k are held constant. Seebeck is a representative constant from the cited thermopile table; alphaSlope=0 is an assumption. Not a wide-temperature or thin-film fit.",
    "sources": [
      {
        "url": "https://www.goodfellow.com/global/copper-disc-group",
        "properties": "rho, Cp, k, resistivity and temperature coefficient; reference temperatures differ as documented above."
      },
      {
        "url": "https://patents.google.com/patent/US8696989B2/en",
        "properties": "Table 1: representative Seebeck coefficient."
      }
    ]
  },
  "Gold.json": {
    "format": "TE_2D_material",
    "version": 1,
    "referenceTemperature": 300,
    "units": {
      "rho": "kg/m^3",
      "Cp": "J/(kg K)",
      "k": "W/(m K)",
      "sigma": "S/m",
      "alpha": "V/K",
      "beta": "1/K",
      "alphaSlope": "V/K^2"
    },
    "material": {
      "name": "Gold",
      "rho": 19300,
      "Cp": 129,
      "k": 318,
      "sigma": 44242306.262940876,
      "alpha": 1.94e-06,
      "beta": 0.003893322951138797,
      "alphaSlope": 0,
      "color": "#e0b64d"
    },
    "notes": "Approximate bulk room-temperature preset. Supplier resistivity at 293.15 K and tabulated temperature coefficient are treated as a local linear law and rebased to 300 K. Density, Cp and k are held constant. Seebeck is a representative constant from the cited thermopile table; alphaSlope=0 is an assumption. Not a wide-temperature or thin-film fit.",
    "sources": [
      {
        "url": "https://www.goodfellow.com/global/gold-pellets-group",
        "properties": "rho, Cp, k, resistivity and temperature coefficient; reference temperatures differ as documented above."
      },
      {
        "url": "https://patents.google.com/patent/US8696989B2/en",
        "properties": "Table 1: representative Seebeck coefficient."
      }
    ]
  },
  "PbTe.json": {
    "format": "TE_2D_material",
    "version": 1,
    "referenceTemperature": 300,
    "units": {
      "rho": "kg/m^3",
      "Cp": "J/(kg K)",
      "k": "W/(m K)",
      "sigma": "S/m",
      "alpha": "V/K",
      "beta": "1/K",
      "alphaSlope": "V/K^2"
    },
    "material": {
      "name": "PbTe (room-temperature model)",
      "rho": 8160,
      "Cp": 151,
      "k": 1.46,
      "sigma": 61000.0,
      "alpha": 0.000187,
      "beta": 0,
      "alphaSlope": 0,
      "color": "#db8bad"
    },
    "notes": "Representative positive-Seebeck PbTe model from Bethke et al., Table 1 (mostly 293 K), held constant at nominal 300 K. beta=0 and alphaSlope=0 are assumptions. Doping, processing and temperature alter actual PbTe properties; this is not a high-temperature material fit.",
    "sources": [
      {
        "url": "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0151708",
        "properties": "Table 1: rho, Cp, k, sigma and Seebeck. Model at nominal 300 K approximates the tabulated near-room-temperature values."
      }
    ]
  },
  "Platinum.json": {
    "format": "TE_2D_material",
    "version": 1,
    "referenceTemperature": 300,
    "units": {
      "rho": "kg/m^3",
      "Cp": "J/(kg K)",
      "k": "W/(m K)",
      "sigma": "S/m",
      "alpha": "V/K",
      "beta": "1/K",
      "alphaSlope": "V/K^2"
    },
    "material": {
      "name": "Platinum",
      "rho": 21450,
      "Cp": 133,
      "k": 71.6,
      "sigma": 9204633.034955211,
      "alpha": -5.28e-06,
      "beta": 0.0038174926863851844,
      "alphaSlope": 0,
      "color": "#b5bbce"
    },
    "notes": "Approximate bulk room-temperature preset. Supplier resistivity at 293.15 K and tabulated temperature coefficient are treated as a local linear law and rebased to 300 K. Density, Cp and k are held constant. Seebeck is a representative constant from the cited thermopile table; alphaSlope=0 is an assumption. Not a wide-temperature or thin-film fit.",
    "sources": [
      {
        "url": "https://www.goodfellow.com/global/platinum-powder-group",
        "properties": "rho, Cp, k, resistivity and temperature coefficient; reference temperatures differ as documented above."
      },
      {
        "url": "https://patents.google.com/patent/US8696989B2/en",
        "properties": "Table 1: representative Seebeck coefficient."
      }
    ]
  }
};
