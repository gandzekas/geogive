name: Feature Request
description: Suggest a new feature or improvement
title: "[Feature] "
labels: ["enhancement"]
body:
  - type: textarea
    id: description
    attributes:
      label: Feature Description
      description: A clear description of what you want to happen
    validations:
      required: true
  - type: textarea
    id: motivation
    attributes:
      label: Motivation
      description: Why would this feature be useful? What problem does it solve?
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: Any alternative solutions or features you've considered
  - type: checkboxes
    id: terms
    attributes:
      label: Code of Conduct
      description: By submitting this issue, you agree to follow our Code of Conduct
      options:
        - label: I agree to follow this project's Code of Conduct
          required: true
