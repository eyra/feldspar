import React, { JSX } from 'react'
import { ReactFactoryContext } from '../../factory'
import { 
  PropsUIPromptFileInput,
  PropsUIPromptProgress,
  PropsUIPromptConfirm,
  PropsUIPromptConsentForm,
  PropsUIPromptRadioInput,
  isPropsUIPromptFileInput,
  isPropsUIPromptProgress,
  isPropsUIPromptConfirm,
  isPropsUIPromptConsentForm,
  isPropsUIPromptRadioInput,
  PropsUIPromptConsentFormTable,
  isPropsUIPromptConsentFormTable,
  PropsUIDataSubmissionButtons,
  isPropsUIDataSubmissionButtons,
  PropsUIPromptText,
  isPropsUIPromptText
} from '../../../../types/prompts'
import { Translatable, PropsUITable } from '../../../../types/elements'
import TextBundle from '../../../../text_bundle'
import { Translator } from '../../../../translator'
import { FileInput } from './file_input'
import { Progress } from './progress'
import { Confirm } from './confirm'
import { RadioInput } from './radio_input'
import { ConsentTable } from './consent_table'
import { DonateButtons } from './donate_buttons'
import { TextBlock } from './text_block'

export interface PromptContext extends ReactFactoryContext {
  onDataSubmissionDataChanged: (key: string, value: any) => void
  onDonate: () => void
}

export interface PromptFactory {
  create: (body: unknown, context: PromptContext) => JSX.Element | null
}

// Helper function to convert Python Text to TypeScript Translatable
function toTranslatable(text: any): Translatable | undefined {
  if (!text) return undefined;
  const bundle = new TextBundle();
  Object.entries(text).forEach(([locale, value]) => {
    bundle.add(locale, value as string);
  });
  return bundle;
}

export class FileInputFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext): JSX.Element | null {
    if (isPropsUIPromptFileInput(body)) {
      return React.createElement(FileInput, { ...body, ...context });
    }
    return null
  }
}

export class ProgressFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext): JSX.Element | null {
    if (isPropsUIPromptProgress(body)) {
      return React.createElement(Progress, { ...body, ...context });
    }
    return null
  }
}

export class ConfirmFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext): JSX.Element | null {
    if (isPropsUIPromptConfirm(body)) {
      return React.createElement(Confirm, { ...body, ...context });
    }
    return null
  }
}

export class RadioInputFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext): JSX.Element | null {
    if (isPropsUIPromptRadioInput(body)) {
      return React.createElement(RadioInput, { ...body, ...context });
    }
    return null
  }
}

export class TableFactory implements PromptFactory {
  create(body: unknown, context: PromptContext): JSX.Element | null {
    if (isPropsUIPromptConsentFormTable(body)) {
      const { id, title, data_frame } = body;
      const dataFrame = JSON.parse(data_frame);

      const headCells = Object.keys(dataFrame).map((column: string) => 
        ({ __type__: "PropsUITableCell" as const, text: column }));
      const head = { __type__: "PropsUITableHead" as const, cells: headCells };
      
      const rows = Object.keys(dataFrame[Object.keys(dataFrame)[0]] || {}).map(rowIndex => ({
        __type__: "PropsUITableRow" as const,
        id: rowIndex,
        cells: Object.keys(dataFrame).map(column => ({
          __type__: "PropsUITableCell" as const,
          text: String(dataFrame[column][rowIndex])
        }))
      }));

      const tableBody = { __type__: "PropsUITableBody" as const, rows };

      const parsedTable: PropsUITable = {
        __type__: 'PropsUITable',
        id,
        head,
        body: tableBody
      };

      return React.createElement(ConsentTable, {
        table: {
          ...parsedTable,
          title: Translator.translate(title, context.locale),
          deletedRowCount: 0
        },
        context,
        onChange: () => {}  // Tables in data submission page are read-only
      });
    }
    return null;
  }
}

export class DonateButtonsFactory implements PromptFactory {
  create(body: unknown, context: PromptContext): JSX.Element | null {
    if (isPropsUIDataSubmissionButtons(body)) {
      const { donateQuestion, donateButton, ...rest } = body;
      const props = {
        ...rest,
        ...context,
        donateQuestion,
        donateButton,
      };
      return React.createElement(DonateButtons, props);
    }
    return null;
  }
}

export class TextBlockFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext): JSX.Element | null {
    if (isPropsUIPromptText(body)) {
      return React.createElement(TextBlock, { ...body, ...context });
    }
    return null
  }
}

export const createPromptFactoriesWithDefaults = (factories: PromptFactory[]=[]): PromptFactory[] => {
    return [
        ...factories,
        new FileInputFactory(),
        new ProgressFactory(),
        new ConfirmFactory(),
        new RadioInputFactory(),
        new TableFactory(),
        new DonateButtonsFactory(),
        new TextBlockFactory()
    ];
}
