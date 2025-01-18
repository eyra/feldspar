import { Weak } from "../../../../helpers";
import { PropsUISpinner } from "../../../../types/elements";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import spinnerLight from "../../../../../assets/lottie/spinner-light.json";
import spinnerDark from "../../../../../assets/lottie/spinner-dark.json";
import { JSX } from "react";

type Props = Weak<PropsUISpinner>;

export const Spinner = ({
  spinning = true,
  color = "light",
}: Props): JSX.Element => {
  function animationData(): string {
    if (color === "dark") {
      return JSON.stringify(spinnerDark);
    }
    return JSON.stringify(spinnerLight);
  }

  return (
    <div id="spinner" className="flex flex-row items-center gap-4">
      <div className="w-5 h-5">
        <DotLottieReact data={animationData()} loop={spinning} autoplay />
      </div>
    </div>
  );
};
