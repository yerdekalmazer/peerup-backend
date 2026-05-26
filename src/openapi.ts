// OpenAPI 3.0 tanımı — Swagger UI tarafından /docs uç noktasında sunulur.
export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "PeerUP Backend API",
    version: "1.0.0",
    description:
      "PeerUP mobil uygulaması ve admin paneli için backend servisi. Kimlik doğrulama: Bearer JWT (Authorization: Bearer <token>).",
  },
  servers: [
    { url: "http://localhost:4000", description: "Yerel geliştirme" },
    { url: "/", description: "Aynı origin" },
  ],
  tags: [
    { name: "Health", description: "Sağlık kontrolü" },
    { name: "Auth", description: "Kayıt / giriş / parola sıfırlama" },
    { name: "Public", description: "Açık uçlar (öğretmen, kategori, zincir, liderler)" },
    { name: "Sessions", description: "Kullanıcının oturumları (rezervasyon)" },
    { name: "Messages", description: "Sohbetler ve mesajlar" },
    { name: "Notifications", description: "Bildirimler" },
    { name: "Profile", description: "Profil, SkillCoin ve kaydedilen öğretmenler" },
    { name: "Admin: Stats", description: "Admin paneli istatistik" },
    { name: "Admin: Teachers", description: "Öğretmen CRUD" },
    { name: "Admin: Users", description: "Kullanıcı yönetimi" },
    { name: "Admin: Sessions", description: "Oturum yönetimi, iptal/iade" },
    { name: "Admin: Categories", description: "Kategori CRUD" },
    { name: "Admin: Chains", description: "Beceri zinciri CRUD" },
    { name: "Admin: Notifications", description: "Bildirim broadcast" },
    { name: "Admin: Analytics", description: "Zaman serisi ve gelir" },
    { name: "Admin: Reports", description: "Şikayet yönetimi" },
    { name: "Admin: Admins", description: "Çoklu admin yönetimi (super_admin)" },
    { name: "Admin: Audit", description: "Audit log (super_admin)" },
    { name: "Admin: Exports", description: "CSV dışa aktarımları" },
  ],
  components: {
    securitySchemes: {
      userBearer: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Kullanıcı JWT (mobil uygulama)",
      },
      adminBearer: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Admin JWT (admin paneli)",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
        required: ["error"],
      },
      Ok: {
        type: "object",
        properties: { ok: { type: "boolean", example: true } },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          avatar: { type: "string" },
          avatarColor: { type: "string" },
          bio: { type: "string" },
          coins: { type: "integer" },
          role: { type: "string", enum: ["student", "teacher"] },
          status: { type: "string", enum: ["active", "suspended"] },
          university: { type: "string", nullable: true },
          department: { type: "string", nullable: true },
          skillsTeach: { type: "array", items: { type: "string" } },
          skillsLearn: { type: "array", items: { type: "string" } },
          savedTeachers: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/User" },
          token: { type: "string" },
        },
        required: ["user", "token"],
      },
      AdminAuthResponse: {
        type: "object",
        properties: {
          admin: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string", format: "email" },
              name: { type: "string" },
              role: { type: "string", enum: ["super_admin", "admin", "moderator"] },
            },
          },
          token: { type: "string" },
        },
      },
      Teacher: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          skill: { type: "string" },
          category: { type: "string" },
          avatar: { type: "string" },
          avatarColor: { type: "string" },
          bio: { type: "string" },
          rating: { type: "number" },
          reviews: { type: "integer" },
          coinRate: { type: "integer" },
          sessionsCount: { type: "integer" },
          online: { type: "boolean" },
          verified: { type: "boolean" },
          badges: { type: "array", items: { type: "string" } },
        },
      },
      Category: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          icon: { type: "string" },
          order: { type: "integer" },
        },
      },
      ChainNode: {
        type: "object",
        properties: {
          id: { type: "string" },
          chainId: { type: "string" },
          name: { type: "string" },
          shortName: { type: "string" },
          avatar: { type: "string" },
          avatarColor: { type: "string" },
          role: { type: "string" },
          skill: { type: "string" },
          sessions: { type: "integer" },
          rating: { type: "number" },
          isOnline: { type: "boolean" },
          position: { type: "integer" },
        },
      },
      SkillChain: {
        type: "object",
        properties: {
          id: { type: "string" },
          skill: { type: "string" },
          category: { type: "string" },
          color: { type: "string" },
          gradient: { type: "array", items: { type: "string" } },
          icon: { type: "string" },
          depth: { type: "integer" },
          totalReach: { type: "integer" },
          nodes: {
            type: "array",
            items: { $ref: "#/components/schemas/ChainNode" },
          },
        },
      },
      Session: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string", nullable: true },
          teacherName: { type: "string" },
          teacherAvatar: { type: "string" },
          avatarColor: { type: "string" },
          skill: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          duration: { type: "integer" },
          cost: { type: "integer" },
          type: { type: "string", enum: ["online", "offline"] },
          status: {
            type: "string",
            enum: ["upcoming", "completed", "cancelled"],
          },
          rating: { type: "number", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Conversation: {
        type: "object",
        properties: {
          id: { type: "string" },
          user: { type: "string" },
          avatar: { type: "string" },
          avatarColor: { type: "string" },
          online: { type: "boolean" },
          lastMessage: { type: "string" },
          time: { type: "string" },
          unread: { type: "integer" },
        },
      },
      Message: {
        type: "object",
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          fromMe: { type: "boolean" },
          time: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Notification: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          type: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          icon: { type: "string" },
          read: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CoinTransaction: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          amount: { type: "integer" },
          type: {
            type: "string",
            enum: ["topup", "spend", "earn", "refund", "credit", "debit"],
          },
          description: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Report: {
        type: "object",
        properties: {
          id: { type: "string" },
          targetType: { type: "string" },
          targetId: { type: "string" },
          reason: { type: "string" },
          note: { type: "string" },
          status: { type: "string", enum: ["open", "resolved", "dismissed"] },
          reporterName: { type: "string" },
          reporterId: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      AdminUser: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
          role: { type: "string", enum: ["super_admin", "admin", "moderator"] },
          lastLoginAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Kimlik doğrulama gerekli veya geçersiz token",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      NotFound: {
        description: "Kayıt bulunamadı",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
      BadRequest: {
        description: "Geçersiz istek",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  },
  paths: {
    // ── Health ─────────────────────────────────────────────────
    "/": {
      get: {
        tags: ["Health"],
        summary: "Sağlık kontrolü",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    service: { type: "string" },
                    status: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Auth ───────────────────────────────────────────────────
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Mobil kullanıcı kaydı",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                  role: { type: "string", enum: ["student", "teacher"] },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Kayıt başarılı",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "409": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Mobil kullanıcı girişi",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Giriş başarılı",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/auth/admin/login": {
      post: {
        tags: ["Auth"],
        summary: "Admin paneli girişi",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Admin girişi başarılı",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdminAuthResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Parola sıfırlama",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Parola güncellendi",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Ok" } },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ── Public ─────────────────────────────────────────────────
    "/api/teachers": {
      get: {
        tags: ["Public"],
        summary: "Öğretmen listesi",
        parameters: [
          {
            name: "category",
            in: "query",
            schema: { type: "string" },
            description: "Kategori filtresi (Tümü = filtresiz)",
          },
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "Ad veya beceride arama",
          },
        ],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Teacher" },
                },
              },
            },
          },
        },
      },
    },
    "/api/teachers/{id}": {
      get: {
        tags: ["Public"],
        summary: "Öğretmen detayı",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Detay",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Teacher" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/categories": {
      get: {
        tags: ["Public"],
        summary: "Kategori listesi",
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Category" },
                },
              },
            },
          },
        },
      },
    },
    "/api/chains": {
      get: {
        tags: ["Public"],
        summary: "Beceri zincirleri",
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/SkillChain" },
                },
              },
            },
          },
        },
      },
    },
    "/api/leaders": {
      get: {
        tags: ["Public"],
        summary: "Lider tablosu (Top 20)",
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      rank: { type: "integer" },
                      name: { type: "string" },
                      avatar: { type: "string" },
                      avatarColor: { type: "string" },
                      skill: { type: "string" },
                      chainScore: { type: "integer" },
                      reach: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Sessions (kullanıcı) ──────────────────────────────────
    "/api/sessions": {
      get: {
        tags: ["Sessions"],
        summary: "Kullanıcının oturumları",
        security: [{ userBearer: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["upcoming", "completed", "cancelled"] },
          },
        ],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Session" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Sessions"],
        summary: "Yeni rezervasyon",
        security: [{ userBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["teacherName", "skill", "date", "time"],
                properties: {
                  teacherName: { type: "string" },
                  skill: { type: "string" },
                  date: { type: "string" },
                  time: { type: "string" },
                  duration: { type: "integer" },
                  cost: { type: "integer" },
                  type: { type: "string", enum: ["online", "offline"] },
                  teacherAvatar: { type: "string" },
                  avatarColor: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Oluşturuldu",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Session" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/sessions/{id}": {
      patch: {
        tags: ["Sessions"],
        summary: "Oturum durumunu güncelle (iptal iade üretir)",
        security: [{ userBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: ["upcoming", "completed", "cancelled"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Güncellendi",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Session" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/sessions/{id}/review": {
      post: {
        tags: ["Sessions"],
        summary: "Tamamlanan oturuma değerlendirme bırak",
        security: [{ userBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["rating"],
                properties: {
                  rating: { type: "integer", minimum: 1, maximum: 5 },
                  comment: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Değerlendirme kaydedildi",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Ok" } },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },

    // ── Conversations ──────────────────────────────────────────
    "/api/conversations": {
      get: {
        tags: ["Messages"],
        summary: "Sohbet listesi",
        security: [{ userBearer: [] }],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Conversation" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Messages"],
        summary: "Yeni sohbet başlat",
        security: [{ userBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["peerName"],
                properties: {
                  peerName: { type: "string" },
                  peerAvatar: { type: "string" },
                  peerColor: { type: "string" },
                  online: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Oluşturuldu (veya mevcut sohbet döner)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Conversation" },
              },
            },
          },
        },
      },
    },
    "/api/conversations/{id}/messages": {
      get: {
        tags: ["Messages"],
        summary: "Sohbet mesajları (görüntülemede okundu işaretler)",
        security: [{ userBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Sohbet + mesajlar",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    conversation: { $ref: "#/components/schemas/Conversation" },
                    messages: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Message" },
                    },
                  },
                },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        tags: ["Messages"],
        summary: "Mesaj gönder",
        security: [{ userBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: { text: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Gönderildi",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Message" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ── Notifications ──────────────────────────────────────────
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "Kullanıcı bildirimleri",
        security: [{ userBearer: [] }],
        responses: {
          "200": {
            description: "Bildirim listesi + okunmamış sayısı",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    notifications: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Notification" },
                    },
                    unread: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/notifications/read-all": {
      post: {
        tags: ["Notifications"],
        summary: "Tüm bildirimleri okundu işaretle",
        security: [{ userBearer: [] }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Ok" } },
            },
          },
        },
      },
    },
    "/api/notifications/{id}/read": {
      post: {
        tags: ["Notifications"],
        summary: "Tek bildirimi okundu işaretle",
        security: [{ userBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Ok" } },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },

    // ── Profile ────────────────────────────────────────────────
    "/api/profile": {
      get: {
        tags: ["Profile"],
        summary: "Profil + istatistikler",
        security: [{ userBearer: [] }],
        responses: {
          "200": {
            description: "Profil",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                    stats: {
                      type: "object",
                      properties: {
                        totalSessions: { type: "integer" },
                        completedSessions: { type: "integer" },
                        upcomingSessions: { type: "integer" },
                        reviewsGiven: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ["Profile"],
        summary: "Profili güncelle",
        security: [{ userBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  bio: { type: "string" },
                  university: { type: "string" },
                  department: { type: "string" },
                  avatarColor: { type: "string" },
                  skillsTeach: { type: "array", items: { type: "string" } },
                  skillsLearn: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Güncellendi",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
        },
      },
    },
    "/api/profile/topup": {
      post: {
        tags: ["Profile"],
        summary: "SkillCoin yükle",
        security: [{ userBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount"],
                properties: {
                  amount: { type: "integer", minimum: 1, maximum: 1000 },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Yüklendi",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/profile/transactions": {
      get: {
        tags: ["Profile"],
        summary: "SkillCoin işlem geçmişi",
        security: [{ userBearer: [] }],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/CoinTransaction" },
                },
              },
            },
          },
        },
      },
    },
    "/api/profile/reviews": {
      get: {
        tags: ["Profile"],
        summary: "Kullanıcının yazdığı değerlendirmeler",
        security: [{ userBearer: [] }],
        responses: { "200": { description: "Liste" } },
      },
    },
    "/api/profile/saved": {
      get: {
        tags: ["Profile"],
        summary: "Kaydedilen öğretmenler",
        security: [{ userBearer: [] }],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Teacher" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Profile"],
        summary: "Öğretmen kaydet",
        security: [{ userBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["teacherId"],
                properties: { teacherId: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Güncellenmiş id listesi" } },
      },
    },
    "/api/profile/saved/{teacherId}": {
      delete: {
        tags: ["Profile"],
        summary: "Kaydedilen öğretmeni kaldır",
        security: [{ userBearer: [] }],
        parameters: [
          {
            name: "teacherId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Güncellenmiş id listesi" } },
      },
    },

    // ── Admin: me + stats ─────────────────────────────────────
    "/api/admin/me": {
      get: {
        tags: ["Admin: Stats"],
        summary: "Aktif admin bilgisi",
        security: [{ adminBearer: [] }],
        responses: {
          "200": {
            description: "Admin",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AdminUser" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/admin/stats": {
      get: {
        tags: ["Admin: Stats"],
        summary: "Genel istatistikler",
        security: [{ adminBearer: [] }],
        responses: { "200": { description: "İstatistik özeti" } },
      },
    },

    // ── Admin: Teachers ───────────────────────────────────────
    "/api/admin/teachers": {
      get: {
        tags: ["Admin: Teachers"],
        summary: "Öğretmen ara/listele",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Teacher" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Admin: Teachers"],
        summary: "Öğretmen oluştur",
        security: [{ adminBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Teacher" },
            },
          },
        },
        responses: {
          "201": {
            description: "Oluşturuldu",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Teacher" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/admin/teachers/{id}": {
      get: {
        tags: ["Admin: Teachers"],
        summary: "Öğretmen detayı",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Detay",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Teacher" },
              },
            },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Admin: Teachers"],
        summary: "Öğretmen güncelle",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Teacher" },
            },
          },
        },
        responses: { "200": { description: "Güncellendi" } },
      },
      delete: {
        tags: ["Admin: Teachers"],
        summary: "Öğretmen sil",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Silindi" } },
      },
    },

    // ── Admin: Users ──────────────────────────────────────────
    "/api/admin/users": {
      get: {
        tags: ["Admin: Users"],
        summary: "Kullanıcı ara/listele",
        security: [{ adminBearer: [] }],
        parameters: [{ name: "q", in: "query", schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Admin: Users"],
        summary: "Kullanıcı oluştur",
        security: [{ adminBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                  role: { type: "string", enum: ["student", "teacher"] },
                  bio: { type: "string" },
                  coins: { type: "integer" },
                  avatarColor: { type: "string" },
                  avatar: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Oluşturuldu" } },
      },
    },
    "/api/admin/users/{id}": {
      get: {
        tags: ["Admin: Users"],
        summary: "Kullanıcı detayı + son aktivite",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Detay" } },
      },
      put: {
        tags: ["Admin: Users"],
        summary: "Kullanıcı güncelle",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/User" },
            },
          },
        },
        responses: { "200": { description: "Güncellendi" } },
      },
      delete: {
        tags: ["Admin: Users"],
        summary: "Kullanıcı sil",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Silindi" } },
      },
    },
    "/api/admin/users/{id}/coins": {
      post: {
        tags: ["Admin: Users"],
        summary: "SkillCoin bakiyesi düzelt",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["amount"],
                properties: {
                  amount: { type: "integer", description: "0 olamaz" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Güncellendi" } },
      },
    },
    "/api/admin/users/{id}/ban": {
      post: {
        tags: ["Admin: Users"],
        summary: "Kullanıcıyı banla",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { reason: { type: "string" } },
              },
            },
          },
        },
        responses: { "200": { description: "Banlandı" } },
      },
    },
    "/api/admin/users/{id}/unban": {
      post: {
        tags: ["Admin: Users"],
        summary: "Banı kaldır",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Aktif" } },
      },
    },

    // ── Admin: Sessions ───────────────────────────────────────
    "/api/admin/sessions": {
      get: {
        tags: ["Admin: Sessions"],
        summary: "Oturumlar",
        security: [{ adminBearer: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["upcoming", "completed", "cancelled"] },
          },
        ],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Session" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Admin: Sessions"],
        summary: "Manuel oturum oluştur",
        security: [{ adminBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Session" },
            },
          },
        },
        responses: { "201": { description: "Oluşturuldu" } },
      },
    },
    "/api/admin/sessions/{id}": {
      put: {
        tags: ["Admin: Sessions"],
        summary: "Oturum güncelle",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Session" },
            },
          },
        },
        responses: { "200": { description: "Güncellendi" } },
      },
      delete: {
        tags: ["Admin: Sessions"],
        summary: "Oturum sil",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Silindi" } },
      },
    },
    "/api/admin/sessions/{id}/cancel": {
      post: {
        tags: ["Admin: Sessions"],
        summary: "Oturum iptal (opsiyonel iade)",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  refund: { type: "boolean", default: true },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "İptal" } },
      },
    },
    "/api/admin/sessions/{id}/refund": {
      post: {
        tags: ["Admin: Sessions"],
        summary: "Manuel SkillCoin iadesi",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  amount: { type: "integer", minimum: 1 },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "İade tamam" } },
      },
    },

    // ── Admin: Categories ─────────────────────────────────────
    "/api/admin/categories": {
      get: {
        tags: ["Admin: Categories"],
        summary: "Kategoriler",
        security: [{ adminBearer: [] }],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Category" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Admin: Categories"],
        summary: "Kategori oluştur",
        security: [{ adminBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["label"],
                properties: {
                  label: { type: "string" },
                  icon: { type: "string" },
                  order: { type: "integer" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Oluşturuldu" } },
      },
    },
    "/api/admin/categories/{id}": {
      put: {
        tags: ["Admin: Categories"],
        summary: "Kategori güncelle",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Category" },
            },
          },
        },
        responses: { "200": { description: "Güncellendi" } },
      },
      delete: {
        tags: ["Admin: Categories"],
        summary: "Kategori sil",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Silindi" } },
      },
    },

    // ── Admin: Chains ─────────────────────────────────────────
    "/api/admin/chains": {
      get: {
        tags: ["Admin: Chains"],
        summary: "Beceri zincirleri",
        security: [{ adminBearer: [] }],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/SkillChain" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Admin: Chains"],
        summary: "Zincir oluştur",
        security: [{ adminBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SkillChain" },
            },
          },
        },
        responses: { "201": { description: "Oluşturuldu" } },
      },
    },
    "/api/admin/chains/{id}": {
      get: {
        tags: ["Admin: Chains"],
        summary: "Zincir detayı",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Detay" } },
      },
      put: {
        tags: ["Admin: Chains"],
        summary: "Zincir güncelle (nodes verilirse tamamen yeniden yazılır)",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SkillChain" },
            },
          },
        },
        responses: { "200": { description: "Güncellendi" } },
      },
      delete: {
        tags: ["Admin: Chains"],
        summary: "Zincir sil",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Silindi" } },
      },
    },

    // ── Admin: Notifications ──────────────────────────────────
    "/api/admin/notifications/broadcast": {
      post: {
        tags: ["Admin: Notifications"],
        summary: "Toplu bildirim gönder",
        security: [{ adminBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  audience: {
                    type: "string",
                    enum: ["all", "students", "teachers"],
                    default: "all",
                  },
                  title: { type: "string" },
                  body: { type: "string" },
                  type: { type: "string", default: "info" },
                  icon: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Gönderim sonucu",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    sent: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Admin: Analytics ──────────────────────────────────────
    "/api/admin/analytics/timeseries": {
      get: {
        tags: ["Admin: Analytics"],
        summary: "Günlük zaman serisi (kullanıcı/oturum/coin akışı)",
        security: [{ adminBearer: [] }],
        parameters: [
          {
            name: "days",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 180, default: 30 },
          },
        ],
        responses: { "200": { description: "Zaman serisi" } },
      },
    },
    "/api/admin/analytics/revenue": {
      get: {
        tags: ["Admin: Analytics"],
        summary: "Coin ekonomisi özeti + ilk kategoriler",
        security: [{ adminBearer: [] }],
        responses: { "200": { description: "Özet" } },
      },
    },

    // ── Admin: Reports ────────────────────────────────────────
    "/api/admin/reports": {
      get: {
        tags: ["Admin: Reports"],
        summary: "Şikayetler",
        security: [{ adminBearer: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["open", "resolved", "dismissed"] },
          },
        ],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Report" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Admin: Reports"],
        summary: "Şikayet oluştur",
        security: [{ adminBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["targetType", "targetId", "reason"],
                properties: {
                  targetType: { type: "string" },
                  targetId: { type: "string" },
                  reason: { type: "string" },
                  note: { type: "string" },
                  reporterName: { type: "string" },
                  reporterId: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Oluşturuldu" } },
      },
    },
    "/api/admin/reports/{id}": {
      put: {
        tags: ["Admin: Reports"],
        summary: "Şikayet güncelle (status: open/resolved/dismissed)",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: ["open", "resolved", "dismissed"],
                  },
                  note: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Güncellendi" } },
      },
      delete: {
        tags: ["Admin: Reports"],
        summary: "Şikayet sil",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Silindi" } },
      },
    },

    // ── Admin: Admins (super_admin) ──────────────────────────
    "/api/admin/admins": {
      get: {
        tags: ["Admin: Admins"],
        summary: "Admin listesi (super_admin)",
        security: [{ adminBearer: [] }],
        responses: {
          "200": {
            description: "Liste",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/AdminUser" },
                },
              },
            },
          },
          "403": { $ref: "#/components/responses/Unauthorized" },
        },
      },
      post: {
        tags: ["Admin: Admins"],
        summary: "Admin oluştur (super_admin)",
        security: [{ adminBearer: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                  role: {
                    type: "string",
                    enum: ["super_admin", "admin", "moderator"],
                  },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Oluşturuldu" } },
      },
    },
    "/api/admin/admins/{id}": {
      put: {
        tags: ["Admin: Admins"],
        summary: "Admin güncelle (super_admin)",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  password: { type: "string", minLength: 6 },
                  role: {
                    type: "string",
                    enum: ["super_admin", "admin", "moderator"],
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Güncellendi" } },
      },
      delete: {
        tags: ["Admin: Admins"],
        summary: "Admin sil (super_admin)",
        security: [{ adminBearer: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Silindi" } },
      },
    },

    // ── Admin: Audit ──────────────────────────────────────────
    "/api/admin/audit-log": {
      get: {
        tags: ["Admin: Audit"],
        summary: "Admin audit log (super_admin)",
        security: [{ adminBearer: [] }],
        parameters: [
          {
            name: "take",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 200, default: 100 },
          },
          { name: "adminId", in: "query", schema: { type: "string" } },
          { name: "action", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "Loglar" } },
      },
    },

    // ── Admin: Exports ────────────────────────────────────────
    "/api/admin/exports/users.csv": {
      get: {
        tags: ["Admin: Exports"],
        summary: "Kullanıcıları CSV indir",
        security: [{ adminBearer: [] }],
        responses: {
          "200": {
            description: "CSV",
            content: {
              "text/csv": { schema: { type: "string" } },
            },
          },
        },
      },
    },
    "/api/admin/exports/sessions.csv": {
      get: {
        tags: ["Admin: Exports"],
        summary: "Oturumları CSV indir",
        security: [{ adminBearer: [] }],
        responses: {
          "200": {
            description: "CSV",
            content: {
              "text/csv": { schema: { type: "string" } },
            },
          },
        },
      },
    },
  },
} as const;
