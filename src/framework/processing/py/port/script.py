import port.api.props as props
from port.api.assets import *
from port.api.commands import (CommandSystemDonate, CommandSystemExit, CommandUIRender)

import pandas as pd

import string
import random

def process(sessionId):
    numberResult = yield render_page(prompt_number())
    size = numberResult.value
    entryCount = 10*size
    print(f"Donate {size}MB")

    content = generate_string(100000)

    data = []
    for entry in range(1, entryCount+1):
        message = f"Preparing entry {entry}"
        percentage = ((entry)/entryCount)*100
        yield render_page(prompt_progress_message(entryCount, message, percentage))
        data.append((content))

    data_frame = pd.DataFrame(data, columns=["load_test"])
    json = data_frame.to_json()
    yield render_page(prompt_donate_message())
    yield CommandSystemDonate(f"{sessionId}", json)


def generate_string(size, chars=string.ascii_uppercase + string.digits):
    return ''.join(random.choice(chars) for _ in range(size))


def prompt_number():
    description = props.Translatable({
        "en": "Please provide the size of the json to be donated in MB.",
    })
    return props.PropsUIPromptNumberInput(description)


def prompt_progress_message(entryCount, message, percentage):
    description = props.Translatable({
        "en": f"One moment please. The json is now being prepared: {entryCount} entries of 100KB",
    })

    return props.PropsUIPromptProgress(description, message, percentage)


def prompt_donate_message():
    description = props.Translatable({
        "en": f"The json is currently being sent to the server..",
    })

    return props.PropsUIPromptProgress(description)


def prompt_finished_message():
    description = props.Translatable({
        "en": f"The json has been sent to the server ✅",
    })

    return props.PropsUIPromptProgress(description)


def render_page(body):
    header = props.PropsUIHeader(props.Translatable({
        "en": "Port load test"
    }))

    page = props.PropsUIPageDonation("Load", header, body)
    return CommandUIRender(page)


def render_end_page():
    page = props.PropsUIPageEnd()
    return CommandUIRender(page)