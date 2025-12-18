const diagramTypeDetectorPrompt = `
  You will be given an image of a diagram.
  Your job is to determine what type of diagram it is between two types: ERD and Physical DB Diagram.
  You must return one of the following types: "ERD" or "PHYSICAL_DB".

  The ERD will normally contain the following elements:
  - Rectangle shapes representing entities
  - Ellipse/oval shapes representing attributes
  - Diamond shapes representing relationships
  - Lines connecting entities, attributes, and relationships
  - Follow Chen Notation for entities and attributes:
    - Entities are represented by rectangles
    - Attributes are represented by ellipses
    - Key attributes are underlined
    - Multivalued attributes are represented by double ellipses
    - Derived attributes are represented by dashed ellipses
    - Composite attributes have nested ellipses

  The Physical DB Diagram will normally contain the following elements:
  - Rectangular tables representing entities with rows are attributes
  - Lines connecting tables representing relationships
  - No diamond shapes
  - No ellipse/oval shapes
`;

export default diagramTypeDetectorPrompt;
