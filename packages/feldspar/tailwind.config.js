/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

module.exports = {
  presets: [require("@novasoftwarefoundation/prism")],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],

  darkMode: "media",
  theme: {
    boxShadow: {
      "2xl": require("@novasoftwarefoundation/prism").theme.extend.boxShadow["prism-card"],
      dialog: "0 10px 40px 0px rgba(0, 0, 0, 0.40)",
    },

    extend: {
      opacity: {
        shadow: ".15",
      },
      spacing: { "84px": "84px", "200px": "200px", "224px": "224px", 34: "136px", 35: "140px" },
      width: {
        sidebar: "320px",
        logo: "240px",
        "logo-sm": "48px",
        sheet: "760px",
        form: "400px",
        card: "376px",
        "image-preview": "120px",
        "image-preview-sm": "200px",
        "image-preview-circle": "120px",
        "image-preview-circle-sm": "150px",
        "button-sm": "14px",
        popup: "480px",
        "popup-sm": "520px",
        "popup-md": "730px",
        "popup-lg": "1228px",
      },
      height: {
        footer: "88px",
        logo: "110px",
        table: 384,
        "logo-sm": "48px",
        "image-card": "200px",
        "image-preview": "90px",
        "image-preview-sm": "150px",
        "image-preview-circle": "120px",
        "image-preview-circle-sm": "150px",
        "button-sm": "14px",
      },

      minWidth: {
        '1/2': '50%',
        '3/4': '75%',
      },
      maxWidth: {
        card: "376px",
        form: "400px",
        sheet: "760px",
        popup: "480px",
        "popup-sm": "520px",
        "popup-md": "730px",
        "popup-lg": "1228px",
        "3/4": "75%",
        "9/10": "90%",
      },
      maxHeight: {
        dropdown: "317px",
        header1: "376px",
        form: "400px",
        mailto: "128px",
      },
    },
  },
  variants: {
    extend: {
      borderColor: ["active", "hover", "disabled"],
      borderWidth: ["active", "hover", "disabled"],
      ringColor: ["hover"],
      ringWidth: ["hover"],
      ringOpacity: ["hover"],
      ringOffsetColor: ["hover"],
      ringOffsetWidth: ["hover"],
      opacity: ["active", "disabled"],
      padding: ["active"],
      boxShadow: ["active"],
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".scrollbar-hide": {
          /* Firefox */
          "scrollbar-width": "thin",

          /* Safari and Chrome */
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
      });

    }),
  ],
};
