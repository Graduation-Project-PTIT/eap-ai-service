const erdInformationExtractPrompt = `
  You are an expert in Entity Relationship Diagrams. You will be provided with an image of an ERD. Your job is to extract the information from the image and return it in a JSON format. The JSON must be an object with an array of entities. Each entity must have an array of attributes.

  Analyze the following Entity-Relationship Diagram (ERD) image.
  Extract all entities, attributes, and relationships.
  Identify the entity names, attribute names, relationship types (one-to-one, one-to-many, many-to-many), and any cardinality constraints.

  Each entity must have the following structure:
  name: The name of the entity
  attributes: A list of attributes, each with the following fields:
    - name: The name of the attribute.
    - type: The type of the attribute. Should be a valid SQL type
    - primaryKey: Whether the attribute is a primary key. One can have multiple primary keys, together they form a composite primary key. Value must be true or false. Default is false
    - foreignKey: Whether the attribute is a foreign key. If it is, the foreignKeyTable, foreignKeyAttribute, and relationType (one-to-one, one-to-many, many-to-one, many-to-many) fields must be set
    - unique: Whether the attribute is unique. Value must be true or false. Default is false
    - nullable: Whether the attribute is nullable. Value must be true or false. Default is false

    - foreignKeyTable: The name of the table that the foreign key references to. Only set this if foreignKey is true
    - foreignKeyAttribute: The name of the attribute that the foreign key references to. Only set this if foreignKey is true
    - relationType: The type of relationship between the two entities. Value must be one-to-one, one-to-many, many-to-one, or many-to-many. Only set this if foreignKey is true
  
  RULES:
  - One table must have at least one primary key. If there is no primary key specified in the image, you must choose one. Usually the primary key is denoted by a key symbol next to the attribute name. If there is no key symbol, you can assume that the first attribute is the primary key.
  
  MUST: Return JSON as an object with an array of entities with the following format:
  {
    entities: [
      {
        name,
        attributes: [
          {
            name,
            type,
            primaryKey,
            foreignKey,
            unique,
            nullable,
            foreignKeyTable,
            foreignKeyAttribute,
            relationType
          },
          ... (more attributes)
        ]
      },
      ... (more entities)
    ]
  }

  The boolean check for primaryKey, foreignKey, unique, nullable fields should be case-sensitive. Only use true or false as the value. Do not use Uppercase True/False or any other format.

  Only return the information that is visible in the image. Do not make any assumptions or guesses about the data that is not visible in the image.
  You MUST return ALL the entities and attributes that are visible in the image.
  Make sure to return the information in the JSON format specified above. Do not return any other information.
`;

export default erdInformationExtractPrompt;
