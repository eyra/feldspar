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
  isPropsUIPromptRadioInput
} from '../../../../types/prompts'
import { FileInput } from './file_input'
import { Progress } from './progress'
import { Confirm } from './confirm'
import { ConsentForm } from './consent_form'
import { RadioInput } from './radio_input'

export interface PromptFactory {
  create: (body: unknown, context: ReactFactoryContext) => JSX.Element | null
}

export class FileInputFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext): JSX.Element | null {
    if (isPropsUIPromptFileInput(body)) {
      return React.createElement(FileInput, { ...body, ...context })
    }
    return null
  }
}

export class ProgressFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext): JSX.Element | null {
    if (isPropsUIPromptProgress(body)) {
      return React.createElement(Progress, { ...body, ...context })
    }
    return null
  }
}

export class ConfirmFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext): JSX.Element | null {
    if (isPropsUIPromptConfirm(body)) {
      return React.createElement(Confirm, { ...body, ...context })
    }
    return null
  }
}

export class ConsentFormFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext): JSX.Element | null {
    if (isPropsUIPromptConsentForm(body)) {
      return React.createElement(ConsentForm, { ...body, ...context })
    }
    return null
  }
}

export class RadioInputFactory implements PromptFactory {
  create(body: unknown, context: ReactFactoryContext): JSX.Element | null {
    if (isPropsUIPromptRadioInput(body)) {
      return React.createElement(RadioInput, { ...body, ...context })
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
        new ConsentFormFactory(),
        new RadioInputFactory()
    ];
}
