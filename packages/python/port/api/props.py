from dataclasses import dataclass
from typing import Optional, TypedDict, Union

import pandas as pd


class Translations(TypedDict):
    """Typed dict containing text that is  display in a speficic language

    Attributes:
        en: English string to display
        nl: Dutch string to display
    """

    en: str
    nl: str


@dataclass
class Translatable:
    """Wrapper class for Translations"""

    translations: Translations

    def toDict(self):
        return self.__dict__.copy()


@dataclass
class PropsUIHeader:
    """Page header

    Attributes:
        title: title of the page
    """

    title: Translatable

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIHeader"
        dict["title"] = self.title.toDict()
        return dict


@dataclass
class PropsUIFooter:
    """Page footer

    Attributes:
        progressPercentage: float indicating the progress in the flow
    """

    progressPercentage: float

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIFooter"
        dict["progressPercentage"] = self.progressPercentage
        return dict


@dataclass
class PropsUIPromptConfirm:
    """Retry submitting a file page

    Prompt the user if they want to submit a new file.
    This can be used in case a file could not be processed.

    Attributes:
        text: message to display
        ok: message to display if the user wants to try again
        cancel: message to display if the user wants to continue regardless
    """

    text: Translatable
    ok: Translatable
    cancel: Translatable

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIPromptConfirm"
        dict["text"] = self.text.toDict()
        dict["ok"] = self.ok.toDict()
        dict["cancel"] = self.cancel.toDict()
        return dict


@dataclass
class PropsUIPromptConsentFormTable:
    """Table to be shown to the participant prior to data_submission

    Attributes:
        id: a unique string to itentify the table after data_submission
        title: title of the table
        data_frame: table to be shown
    """

    id: str
    title: Translatable
    description: Translatable
    data_frame: pd.DataFrame
    headers: Optional[dict[str, Translatable]] = None

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIPromptConsentFormTable"
        dict["id"] = self.id
        dict["title"] = self.title.toDict()
        dict["description"] = self.description.toDict()
        dict["data_frame"] = self.data_frame.to_json()
        if self.headers:
            dict["headers"] = {
                key: value.toDict() for key, value in self.headers.items()
            }
        return dict


@dataclass
class PropsUIPromptConsentForm:
    """Tables to be shown to the participant prior to data submission

    Attributes:
        tables: a list of tables, including both editable and read-only tables
        description: Optional description text
        donate_question: Optional question text for data submission button
        donate_button: Optional text for data submission button
    """

    tables: list[PropsUIPromptConsentFormTable]
    description: Optional[Translatable] = None
    donate_question: Optional[Translatable] = None
    donate_button: Optional[Translatable] = None

    def translate_tables(self):
        output = []
        for table in self.tables:
            output.append(table.toDict())
        return output

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIPromptConsentForm"
        dict["tables"] = self.translate_tables()
        dict["description"] = self.description and self.description.toDict()
        dict["donateQuestion"] = self.donate_question and self.donate_question.toDict()
        dict["donateButton"] = self.donate_button and self.donate_button.toDict()
        return dict


@dataclass
class PropsUIPromptFileInput:
    """Prompt the user to submit a file

    Attributes:
        description: text with an explanation
        extensions: accepted mime types, example: "application/zip, text/plain"
    """

    description: Translatable
    extensions: str

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIPromptFileInput"
        dict["description"] = self.description.toDict()
        dict["extensions"] = self.extensions
        return dict


@dataclass
class PropsUIPromptProgress:
    """Prompt the user information during the extraction

    Attributes:
        description: text with an explanation
        message: can be used to show extraction progress
    """

    description: Translatable
    message: str
    percentage: Optional[int] = None

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIPromptProgress"
        dict["description"] = self.description.toDict()
        dict["message"] = self.message
        dict["percentage"] = self.percentage

        return dict


class RadioItem(TypedDict):
    """Radio button

    Attributes:
        id: id of radio button
        value: text to be displayed
    """

    id: int
    value: str


@dataclass
class PropsUIPromptRadioInput:
    """Radio group

    This radio group can be used get a mutiple choice answer from a user

    Attributes:
        title: title of the radio group
        description: short description of the radio group
        items: a list of radio buttons
    """

    title: Translatable
    description: Translatable
    items: list[RadioItem]

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIPromptRadioInput"
        dict["title"] = self.title.toDict()
        dict["description"] = self.description.toDict()
        dict["items"] = self.items
        return dict


@dataclass
class PropsUIPromptHelloWorld:
    """Hello world component to welcome users

    Attributes:
        text: welcome message to display
    """

    text: Translatable

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIPromptHelloWorld"
        dict["text"] = self.text
        return dict


@dataclass
class PropsUIPromptText:
    """Text block to display information to the user

    Attributes:
        title: optional title for the text block
        text: main text content to display
    """

    text: Translatable
    title: Optional[Translatable] = None

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIPromptText"
        dict["title"] = self.title and self.title.toDict()
        dict["text"] = self.text.toDict()
        return dict


@dataclass
class PropsUIDataSubmissionButtons:
    """Buttons for data submission actions

    Attributes:
        donate_question: Optional question text above buttons
        donate_button: Optional text for donate button
        waiting: Whether the data submission is in progress
    """

    donate_question: Optional[Translatable] = None
    donate_button: Optional[Translatable] = None
    waiting: bool = False

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIDataSubmissionButtons"
        dict["donateQuestion"] = self.donate_question and self.donate_question.toDict()
        dict["donateButton"] = self.donate_button and self.donate_button.toDict()
        dict["waiting"] = self.waiting
        return dict


@dataclass
class PropsUIPageDataSubmission:
    """A multi-purpose page that gets shown to the user

    Attributes:
        platform: the platform name the user is curently in the process of donating data from
        header: page header
        body: main body of the page, see the individual classes for an explanation
    """

    platform: str
    header: PropsUIHeader
    body: Union[
        PropsUIPromptRadioInput,
        PropsUIPromptConsentForm,
        PropsUIPromptFileInput,
        PropsUIPromptConfirm,
        PropsUIPromptProgress,
        PropsUIPromptHelloWorld,
        PropsUIPromptConsentFormTable,
        PropsUIDataSubmissionButtons,
        list,
    ]

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIPageDataSubmission"
        dict["platform"] = self.platform
        dict["header"] = self.header.toDict()
        if isinstance(self.body, list):
            dict["body"] = [item.toDict() for item in self.body]
        else:
            dict["body"] = [self.body.toDict()]
        return dict


class PropsUIPageEnd:
    """An ending page to show the user they are done"""

    def toDict(self):
        dict = {}
        dict["__type__"] = "PropsUIPageEnd"
        return dict
