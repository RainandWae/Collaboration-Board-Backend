import swaggerJSDoc from "swagger-jsdoc";

export const openApiSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Collaboration Board API",
      version: "0.1.0",
      description:
        "Backend API for a real-time collaborative task board with boards, lists, cards, comments, roles, search, and Socket.io events."
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Local development server"
      }
    ],
    tags: [
      { name: "Health" },
      { name: "Auth" },
      { name: "Boards" },
      { name: "Lists" },
      { name: "Cards" },
      { name: "Search" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "string",
              example: "You cannot access this resource"
            }
          }
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", example: "owner@example.com" },
            name: { type: "string", example: "Owner" }
          }
        },
        AuthSession: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: { $ref: "#/components/schemas/User" }
          }
        },
        BoardMember: {
          type: "object",
          properties: {
            role: {
              type: "string",
              enum: ["OWNER", "EDITOR", "VIEWER"]
            },
            user: { $ref: "#/components/schemas/User" }
          }
        },
        Board: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string", example: "Launch Plan" },
            lists: {
              type: "array",
              items: { $ref: "#/components/schemas/List" }
            },
            members: {
              type: "array",
              items: { $ref: "#/components/schemas/BoardMember" }
            }
          }
        },
        List: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            boardId: { type: "string", format: "uuid" },
            title: { type: "string", example: "Todo" },
            position: { type: "integer", example: 0 },
            cards: {
              type: "array",
              items: { $ref: "#/components/schemas/Card" }
            }
          }
        },
        Card: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            listId: { type: "string", format: "uuid" },
            title: { type: "string", example: "Write API docs" },
            description: { type: "string", nullable: true },
            position: { type: "integer", example: 0 },
            version: { type: "integer", example: 1 }
          }
        },
        Comment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            body: { type: "string", example: "Looks good @owner@example.com" },
            createdAt: { type: "string", format: "date-time" },
            author: { $ref: "#/components/schemas/User" }
          }
        },
        Activity: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            action: { type: "string", example: "CARD_MOVED" },
            metadata: { type: "object" },
            createdAt: { type: "string", format: "date-time" },
            actor: { $ref: "#/components/schemas/User" }
          }
        }
      }
    },
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Check API health",
          responses: {
            "200": {
              description: "API is running",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" }
                    }
                  }
                }
              }
            }
          }
        }
      },

      "/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register a new user",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "email", "password"],
                  properties: {
                    name: { type: "string", example: "Owner" },
                    email: { type: "string", example: "owner@example.com" },
                    password: { type: "string", example: "password123" }
                  }
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Registered user session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AuthSession" }
                }
              }
            },
            "409": {
              description: "Email already exists",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        }
      },

      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login with email and password",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string", example: "owner@example.com" },
                    password: { type: "string", example: "password123" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Authenticated user session",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AuthSession" }
                }
              }
            },
            "401": {
              description: "Invalid credentials",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" }
                }
              }
            }
          }
        }
      },

      "/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get current authenticated user",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Current user",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      user: { $ref: "#/components/schemas/User" }
                    }
                  }
                }
              }
            }
          }
        }
      },

      "/boards": {
        get: {
          tags: ["Boards"],
          summary: "List boards visible to the authenticated user",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "User boards",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      boards: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Board" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ["Boards"],
          summary: "Create a board",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title"],
                  properties: {
                    title: { type: "string", example: "Product Roadmap" }
                  }
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Created board",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      board: { $ref: "#/components/schemas/Board" }
                    }
                  }
                }
              }
            }
          }
        }
      },

      "/boards/{boardId}": {
        get: {
          tags: ["Boards"],
          summary: "Get board details with lists, cards, and members",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "boardId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          responses: {
            "200": {
              description: "Board details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      board: { $ref: "#/components/schemas/Board" },
                      role: {
                        type: "string",
                        enum: ["OWNER", "EDITOR", "VIEWER"]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      "/boards/{boardId}/members": {
        post: {
          tags: ["Boards"],
          summary: "Add a member to a board",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "boardId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "role"],
                  properties: {
                    email: { type: "string", example: "editor@example.com" },
                    role: {
                      type: "string",
                      enum: ["EDITOR", "VIEWER"],
                      example: "EDITOR"
                    }
                  }
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Member added",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      member: { $ref: "#/components/schemas/BoardMember" }
                    }
                  }
                }
              }
            }
          }
        }
      },

      "/boards/{boardId}/lists": {
        get: {
          tags: ["Lists"],
          summary: "List board lists",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "boardId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          responses: {
            "200": {
              description: "Board lists",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      lists: {
                        type: "array",
                        items: { $ref: "#/components/schemas/List" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ["Lists"],
          summary: "Create a list on a board",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "boardId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title"],
                  properties: {
                    title: { type: "string", example: "Todo" }
                  }
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Created list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      list: { $ref: "#/components/schemas/List" }
                    }
                  }
                }
              }
            }
          }
        }
      },

      "/boards/{boardId}/activity": {
        get: {
          tags: ["Boards"],
          summary: "Get board activity log",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "boardId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 20 }
            }
          ],
          responses: {
            "200": {
              description: "Board activity",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      activities: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Activity" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      "/lists/{listId}/cards": {
        get: {
          tags: ["Cards"],
          summary: "List cards in a list",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "listId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          responses: {
            "200": {
              description: "List cards",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      cards: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Card" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ["Cards"],
          summary: "Create a card in a list",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "listId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title"],
                  properties: {
                    title: { type: "string", example: "Build Swagger docs" },
                    description: { type: "string", example: "Document the backend API" }
                  }
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Created card",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      card: { $ref: "#/components/schemas/Card" }
                    }
                  }
                }
              }
            }
          }
        }
      },

      "/cards/{cardId}": {
        get: {
          tags: ["Cards"],
          summary: "Get one card",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "cardId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          responses: {
            "200": {
              description: "Card details",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      card: { $ref: "#/components/schemas/Card" }
                    }
                  }
                }
              }
            }
          }
        },
        patch: {
          tags: ["Cards"],
          summary: "Update a card using optimistic concurrency",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "cardId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["version"],
                  properties: {
                    title: { type: "string", example: "Updated title" },
                    description: { type: "string", example: "Updated description" },
                    version: { type: "integer", example: 1 }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Updated card",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      card: { $ref: "#/components/schemas/Card" }
                    }
                  }
                }
              }
            },
            "409": {
              description: "Version conflict",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: { type: "string" },
                      latestCard: { $ref: "#/components/schemas/Card" }
                    }
                  }
                }
              }
            }
          }
        },
        delete: {
          tags: ["Cards"],
          summary: "Delete a card",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "cardId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          responses: {
            "204": {
              description: "Card deleted"
            }
          }
        }
      },

      "/cards/{cardId}/move": {
        patch: {
          tags: ["Cards"],
          summary: "Move a card to another position or list",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "cardId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["targetListId", "position", "version"],
                  properties: {
                    targetListId: { type: "string", format: "uuid" },
                    position: { type: "integer", example: 0 },
                    version: { type: "integer", example: 2 }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Moved card",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      card: { $ref: "#/components/schemas/Card" }
                    }
                  }
                }
              }
            },
            "409": {
              description: "Version conflict"
            }
          }
        }
      },

      "/cards/{cardId}/comments": {
        get: {
          tags: ["Cards"],
          summary: "List comments on a card",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "cardId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          responses: {
            "200": {
              description: "Card comments",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      comments: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Comment" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ["Cards"],
          summary: "Create a comment on a card",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "cardId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["body"],
                  properties: {
                    body: {
                      type: "string",
                      example: "Please review this @editor@example.com"
                    }
                  }
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Created comment",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      comment: { $ref: "#/components/schemas/Comment" }
                    }
                  }
                }
              }
            }
          }
        }
      },

      "/search/cards": {
        get: {
          tags: ["Search"],
          summary: "Search cards visible to the authenticated user",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string", example: "integration" }
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", default: 10 }
            }
          ],
          responses: {
            "200": {
              description: "Matching cards",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      cards: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Card" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: []
});