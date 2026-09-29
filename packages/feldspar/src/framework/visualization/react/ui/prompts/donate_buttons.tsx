import React, { JSX, useCallback, useEffect, useState } from "react";
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
    const [longWaiting, setLongWaiting] = useState(false);

    useEffect(() => {
        if (!waiting) return;

        const timeout = window.setTimeout(() => setLongWaiting(true), 30_000);
        return () => window.clearTimeout(timeout);
    }, [waiting]);
    
    const handleDonate = useCallback(() => {
        setWaiting(true);
        onDonate();
    }, [onDonate, setWaiting]);

  return (
    <div>
      <BodyLarge
        margin=""
        text={Translator.translate(
          waiting
            ? (longWaiting ? longSubmittingLabel : submittingLabel)
            : (donateQuestion ?? donateQuestionLabel),
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

const submittingLabel = new TextBundle()
  .add("en", "Sending your donation. Please keep this window open.")
  .add("de", "Ihre Datenspende wird gesendet. Bitte lassen Sie dieses Fenster geöffnet.")
  .add("it", "Invio della tua donazione in corso. Tieni aperta questa finestra.")
  .add("es", "Enviando su donación. Por favor, mantenga esta ventana abierta.")
  .add("nl", "Uw donatie wordt verzonden. Houd dit venster open.")
  .add("ro", "Se trimite donația dumneavoastră. Vă rugăm să păstrați această fereastră deschisă.")
  .add("lt", "Siunčiami jūsų paaukoti duomenys. Prašome neuždaryti šio lango.");

const longSubmittingLabel = new TextBundle()
  .add("en", "Sending your donation. This may take 10 minutes or longer. Please keep this window open.")
  .add("de", "Ihre Datenspende wird gesendet. Dies kann 10 Minuten oder länger dauern. Bitte lassen Sie dieses Fenster geöffnet.")
  .add("it", "Invio della tua donazione in corso. Potrebbero volerci 10 minuti o più. Tieni aperta questa finestra.")
  .add("es", "Enviando su donación. Esto puede tardar 10 minutos o más. Por favor, mantenga esta ventana abierta.")
  .add("nl", "Uw donatie wordt verzonden. Dit kan 10 minuten of langer duren. Houd dit venster open.")
  .add("ro", "Se trimite donația dumneavoastră. Acest lucru poate dura 10 minute sau mai mult. Vă rugăm să păstrați această fereastră deschisă.")
  .add("lt", "Siunčiami jūsų paaukoti duomenys. Tai gali užtrukti 10 minučių ar ilgiau. Prašome neuždaryti šio lango.");
