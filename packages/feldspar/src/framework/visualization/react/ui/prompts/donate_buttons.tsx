import React, { JSX, useCallback, useState } from "react";
import { LabelButton, PrimaryButton } from "../elements/button";
import { BodyLarge } from "../elements/text";
import TextBundle from "../../../../text_bundle";
import { Translator } from "../../../../translator";
import { Text } from "../../../../types/elements";

interface Props {
  onDonate: () => void;
  onCancel: () => void;
  locale: string;
  donateQuestion?: Text;
  donateButton?: Text;
}

export const DonateButtons = ({ onDonate, onCancel, locale, donateQuestion, donateButton }: Props): JSX.Element => {
    const [waiting, setWaiting] = useState(false);
    
    const handleDonate = useCallback(() => {
        setWaiting(true);
        onDonate();
    }, [onDonate, setWaiting]);

  return (
    <div>
      <BodyLarge
        margin=""
        text={Translator.translate(
          donateQuestion ?? donateQuestionLabel,
          locale
        )}
      />
      <div className="flex flex-row gap-4 mt-4 mb-4">
        <PrimaryButton
          label={Translator.translate(
            donateButton ?? donateButtonLabel,
            locale
          )}
          onClick={handleDonate}
          color="bg-success text-white"
          spinning={waiting}
        />
        <LabelButton
          label={Translator.translate(cancelButtonLabel, locale)}
          onClick={onCancel}
          color="text-grey1"
        />
      </div>
    </div>
  );
};

const donateQuestionLabel = new TextBundle()
  .add("en", "Do you want to donate the above data?")
  .add("nl", "Wilt u de bovenstaande gegevens doneren?");

const donateButtonLabel = new TextBundle()
  .add("en", "Yes, donate")
  .add("nl", "Ja, doneer");

const cancelButtonLabel = new TextBundle()
  .add("en", "No")
  .add("nl", "Nee");