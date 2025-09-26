import sys
from dataclasses import dataclass
from typing import Any, Generator


@dataclass
class PromptValue:
    __type__: str
    value: str


def create_prompt_value(value: str) -> PromptValue:
    """Create a PromptValue dataclass instance."""
    return PromptValue("PayloadString", value)


def run_generator_with_prompt(flow: Generator, prompt_type: str, prompt_value: Any) -> Any:
    """Run generator expecting a specific prompt type.

    Args:
        flow: The generator to run
        prompt_type: Expected prompt type (e.g., "PayloadString")
        prompt_value: The value to send when prompt is expected

    Returns:
        The final response from the generator
    """
    # Get initial outputs
    expect(flow, "CommandSystemDonate")
    expect(flow, "CommandSystemDonate")

    # Create prompt object with the specified type
    prompt = PromptValue(prompt_type, prompt_value)

    # Send the prompt and get response
    return flow.send(prompt)

import sys
from dataclasses import dataclass
from typing import Any, Generator


@dataclass
class PromptValue:
    __type__: str
    value: str


def create_prompt_value(value: str) -> PromptValue:
    """Create a PromptValue dataclass instance."""
    return PromptValue("PayloadString", value)


def pretty_print_response(response: Any) -> None:
    """Pretty print a response object with nice formatting.

    Args:
        response: The response object to print
    """
    if isinstance(response, dict):
        resp_type = response.get('__type__', 'Unknown')

        if resp_type == 'CommandUIRender':
            page = response.get('page', {})
            if page.get('__type__') == 'PropsUIPageDataSubmission':
                print(f"\n🎯 Instagram Data Donation Page")

                # Print body components
                body = page.get('body', [])

                for component in body:
                    comp_type = component.get('__type__', 'Unknown')

                    if comp_type == 'PropsUIPromptText':
                        text = component.get('text', {}).get('translations', {}).get('en', '')
                        print(f"\n📝 {text}")

                    elif comp_type == 'PropsUIPromptConsentFormTable':
                        title = component.get('title', {}).get('translations', {}).get('en', '')
                        description = component.get('description', {}).get('translations', {}).get('en', '')
                        table_id = component.get('id', '')

                        print(f"\n📊 {title}")
                        print(f"   {description}")

                        # Parse and display the data frame
                        import json
                        import pandas as pd
                        df_json = component.get('data_frame', '{}')
                        df_data = json.loads(df_json)
                        df = pd.DataFrame(df_data)

                        if not df.empty:
                            total_rows = len(df)
                            df_display = df.head(10)  # Show first 10 rows

                            print(f"   Data ({total_rows} rows):")
                            # Convert to string representation with proper spacing
                            df_str = df_display.to_string(index=False)
                            for line in df_str.split('\n'):
                                print(f"   {line}")

                            # Add summary if truncated
                            if total_rows > 10:
                                print(f"   ... and {total_rows - 10} more rows")

                    elif comp_type == 'PropsUIDataSubmissionButtons':
                        question = component.get('donateQuestion', {}).get('translations', {}).get('en', '')
                        button = component.get('donateButton', {}).get('translations', {}).get('en', '')
                        print(f"\n❓ {question}")
                        print(f"   [🎁 {button}]")

        elif resp_type == 'CommandSystemDonate':
            print(f"\n🚀 {resp_type}")

        elif resp_type == 'CommandSystemExit':
            print(f"\n✅ {resp_type}: {response.get('message', 'No message')}")

        else:
            print(f"\n🔧 {resp_type}")
    else:
        print(f"\n📋 {response}")


def expect(flow: Generator, expected_type: str) -> Any:
    """Get next value from generator and verify it matches expected type.

    Args:
        flow: The generator to get next value from
        expected_type: Expected __type__ field value

    Returns:
        The response from the generator

    Raises:
        AssertionError: If the response type doesn't match expected
    """
    response = next(flow)
    if hasattr(response, '__type__'):
        assert response.__type__ == expected_type, f"Expected {expected_type}, got {response.__type__}"
    elif hasattr(response, 'get') and response.get('__type__'):
        assert response['__type__'] == expected_type, f"Expected {expected_type}, got {response['__type__']}"
    else:
        raise AssertionError(f"Response has no __type__ field: {response}")

    pretty_print_response(response)
    return response


def run_generator_with_prompt(flow: Generator, prompt_type: str, prompt_value: Any) -> Any:
    """Run generator expecting a specific prompt type.

    Args:
        flow: The generator to run
        prompt_type: Expected prompt type (e.g., "PayloadString")
        prompt_value: The value to send when prompt is expected

    Returns:
        The final response from the generator
    """
    # Get initial outputs
    expect(flow, "CommandSystemDonate")
    expect(flow, "CommandUIRender")

    prompt = PromptValue(prompt_type, prompt_value)

    # Send the prompt and get response
    response = flow.send(prompt)
    # The donation page
    assert response["__type__"] == "CommandUIRender"
    pretty_print_response(response)

    return response


def run_test_flow(input_value: str):
    """Run a test flow with the given input value."""
    from port.main import start

    flow = start({"locale": "en", "sessionId": "test"})
    run_generator_with_prompt(flow, "PayloadString", input_value)


def main():
    """Main entry point for testing."""
    run_test_flow(sys.argv[1])
