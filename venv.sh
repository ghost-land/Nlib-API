#!/bin/bash

# Check if .venv directory exists
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    sudo python3 -m venv .venv
    source .venv/bin/activate
    python3 -m pip install -r requirements.txt
    echo "Virtual environment created successfully."
else
    echo "Virtual environment already exists. Activating it..."
    source .venv/bin/activate
    echo "Installing requirements..."
    python3 -m pip install -r requirements.txt
fi