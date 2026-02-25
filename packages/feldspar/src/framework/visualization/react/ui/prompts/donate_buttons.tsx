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
  .add("de", "Möchten Sie die obenstehenden Daten spenden?")
  .add("it", "Vuoi donare i dati sopra indicati?")
  .add("es", "¿Desea donar los datos anteriores?")
  .add("nl", "Wilt u de bovenstaande gegevens doneren?")
  .add("ro", "Doriți să donați datele de mai sus?")
  .add("lt", "Ar norite paaukoti aukščiau nurodytus duomenis?");

const donateButtonLabel = new TextBundle()
  .add("en", "Yes, donate")
  .add("de", "Ja, spenden")
  .add("it", "Sì, dona")
  .add("es", "Sí, donar")
  .add("nl", "Ja, doneer")
  .add("ro", "Da, donați")
  .add("lt", "Taip, paaukokite");

const cancelButtonLabel = new TextBundle()
  .add("en", "No")
  .add("de", "Nein")
  .add("it", "No")
  .add("es", "No")
  .add("nl", "Nee")
  .add("ro", "Nu")
  .add("lt", "Ne");
