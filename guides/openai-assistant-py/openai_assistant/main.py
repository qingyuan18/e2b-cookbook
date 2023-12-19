import os
from dotenv import load_dotenv
from e2b import Sandbox
import openai
import time
from openai_assistant.actions import (
    create_directory,
    read_file,
    save_content_to_file,
    list_files,
    commit,
    make_pull_request,
    REPO_DIRECTORY,
)

from rich import print
from rich.console import Console
from rich.spinner import Spinner
from rich.theme import Theme
from rich.prompt import Prompt

class MyPrompt(Prompt):
    prompt_suffix = ""


load_dotenv()
client = openai.Client()

AI_ASSISTANT_ID = os.getenv("AI_ASSISTANT_ID")
assistant = client.beta.assistants.retrieve(AI_ASSISTANT_ID)


custom_theme = Theme(
    {
        "theme": "bold #666666",  # Adjust color as needed
    }
)


def prompt_user_for_github_repo():
    user_repo = MyPrompt.ask(
        "\nWhat GitHub repository do you want to work in?\nPlease provide it in format [bold #E0E0E0]your_username/your_repository_name[/bold #E0E0E0]\n\nRepository: "
    )
    print("\n🔄[#E57B00][italic] Cloning the repo[/#E57B00][/italic]", end="\n")
    print("", end="\n")

    repo_url = f"https://github.com/{user_repo.strip()}.git"

    return repo_url


def prompt_user_for_task(repo_url):
    user_task_specification = MyPrompt.ask(
        "\n\n🤖[#E57B00][bold italic] The AI developer is working in the cloned repository[/bold italic][/#E57B00]\n\nWhat do you want to do? "
    )
    user_task = (
        f"Please work with the codebase repository called {repo_url} "
        f"that is cloned in the /home/user/repo directory. React on the following user's comment: {user_task_specification}"
    )
    print("", end="\n")
    return user_task


def prompt_user_for_auth():
    user_auth = MyPrompt.ask(
        "\nProvide [bold]GitHub token[/bold] with following permissions:\n\n\u2022 read:org\n\u2022 read:project\n\u2022 repo\n\nFind or create your token at [bold #0096FF]https://github.com/settings/tokens[/bold #0096FF]\n\nToken:",
        password=True,
    )
    print("", end="\n")
    return user_auth


# Create a Rich Console instance with our custom theme
console = Console(theme=custom_theme)


def handle_sandbox_stdout(message):
    console.print(f"[theme][Sandbox][/theme] {message.line}")


def handle_sandbox_stderr(message):
    console.print(f"[theme][Sandbox][/theme] {message.line}")


def main():
    print("\n🤖[#E57B00][bold italic] AI developer[/#E57B00][/bold italic]")
    user_gh_token = prompt_user_for_auth()
    repo_url = prompt_user_for_github_repo()

    # Create the sandbox
    sandbox = Sandbox(
        on_stderr=handle_sandbox_stderr,
        on_stdout=handle_sandbox_stdout,
    )
    sandbox.add_action(create_directory).add_action(read_file).add_action(
        save_content_to_file
    ).add_action(list_files).add_action(commit).add_action(make_pull_request)

    # Identify AI developer in git
    sandbox.process.start_and_wait(
        "git config --global user.email 'ai-developer@email.com'"
    )
    sandbox.process.start_and_wait("git config --global user.name 'AI Developer'")

    # Use the GitHub token
    proc = sandbox.process.start_and_wait(
        f"echo {user_gh_token} | gh auth login --with-token"
    )
    if proc.exit_code != 0:
        print("Error: Unable to log into GitHub", end="\n")
        print(proc.stderr)
        print(proc.stdout)
        exit(1)

    # Check that the user is logged into GitHub
    proc = sandbox.process.start_and_wait("gh auth status")
    if proc.exit_code != 0:
        print("Error: Unable to log into GitHub")
        print(proc.stderr)
        print(proc.stdout)
        exit(1)

    # Setup user's credentials
    proc = sandbox.process.start_and_wait("gh auth setup-git")
    if proc.exit_code != 0:
        print("Error: Unable to set up Git auth with GitHub")
        print(proc.stderr)
        print(proc.stdout)
        exit(1)
    else:
        print("\n✅ [#E57B00][italic]Logged in[/#E57B00][/italic]")

    # Clone the repository
    git_clone_proc = sandbox.process.start_and_wait(
        f"git clone {repo_url} {REPO_DIRECTORY}"
    )
    if git_clone_proc.exit_code != 0:
        print("Error: Unable to clone the repository")
        exit(1)

    while True:
        user_task = prompt_user_for_task(repo_url)

        thread = client.beta.threads.create(
            messages=[
                {
                    "role": "user",
                    "content": f"Carefully plan this task and start working on it: {user_task} in the {repo_url} repository",
                },
            ],
        )

        run = client.beta.threads.runs.create(
            thread_id=thread.id, assistant_id=assistant.id
        )

        spinner = ""
        with console.status(spinner):
            previous_status = None
            while True:
                if run.status != previous_status:
                    console.print(
                        f"[bold #FF8800]>[/bold #FF8800] Assistant is currently in status: {run.status} [#666666](waiting for OpenAI)[/#666666]"
                    )
                    previous_status = run.status
                if run.status == "requires_action":
                    outputs = sandbox.openai.actions.run(run)
                    if len(outputs) > 0:
                        client.beta.threads.runs.submit_tool_outputs(
                            thread_id=thread.id, run_id=run.id, tool_outputs=outputs
                        )
                elif run.status == "completed":
                    console.print(
                        "\n✅[#E57B00][italic] Run completed[/#E57B00][/italic]"
                    )
                    messages = (
                        client.beta.threads.messages.list(thread_id=thread.id)
                        .data[0]
                        .content
                    )
                    text_messages = [
                        message for message in messages if message.type == "text"
                    ]
                    console.print("Thread finished:", text_messages[0].text.value)
                    break

                elif run.status in ["queued", "in_progress"]:
                    pass

                elif run.status in ["cancelled", "cancelling", "expired", "failed"]:
                    break

                else:
                    print(f"Unknown status: {run.status}")
                    break

                run = client.beta.threads.runs.retrieve(
                    thread_id=thread.id, run_id=run.id
                )
                time.sleep(0.5)


if __name__ == "__main__":
    main()
