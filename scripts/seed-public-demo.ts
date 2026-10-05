import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Seeding realistic ESH demo data for public website...");

  const user = await db.user.findFirst();
  if (!user) {
    throw new Error("No user found in database to act as author.");
  }

  const seniorTeam = await db.team.findFirst({ where: { category: "SENIOR" } });
  const u17Team = await db.team.findFirst({ where: { category: "U17" } });
  const competition = await db.competition.findFirst();
  const season = await db.season.findFirst({ where: { isCurrent: true } }) || await db.season.findFirst();

  if (!seniorTeam || !competition) {
    throw new Error("Senior team or competition missing in database.");
  }

  // 1. Clean up previous demo news & announcements if any have identical slugs
  await db.newsTranslation.deleteMany({
    where: {
      slug: {
        in: [
          "victoire-derby-regional-esh",
          "fawz-derby-regional-esh",
          "ecole-football-inscriptions-nouvelle-saison",
          "tasjilat-madrasat-esh-koura",
          "stage-preparation-reussi-equipe-premiere",
          "tarabos-tahdiri-esh-sidi-hosni",
          "u17-finale-coupe-de-ligue",
          "u17-kass-rabita-esh",
          "bilan-medical-effectif-esh",
          "taqrir-tibbi-esh-sidi-hosni"
        ]
      }
    }
  });

  // 2. Bilingual News Articles
  const newsData = [
    {
      category: "الفريق الأول / Équipe Première",
      tags: ["Senior", "Derby", "Victoire", "Ligue"],
      featuredImageUrl: "/branding/esh-logo-256.png",
      publishedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      translations: [
        {
          locale: "ar",
          title: "انتصار ثمين لأمل سيدي حسني في الديربي الجهوي وسط حضور جماهيري غفير",
          slug: "fawz-derby-regional-esh",
          content: `حقق نادي أمل سيدي حسني فوزاً مستحقاً ومثيراً بنتيجة هدفين مقابل هدف (2-1) في مواجهة الديربي الجهوي، في لقاء شهد حضوراً جماهيرياً كبيراً غصت به مدرجات الملعب البلدي لسيدي حسني.\n\nوافتتح الفريق التسجيل في الدقيقة 34 من الشوط الأول بعد جملة تكتيكية منسقة، قبل أن يضاعف النتيجة مطلع الشوط الثاني. وقد أبان اللاعبون عن روح قتالية عالية وانضباط تكتيكي مميز نال إشادة الطاقم الفني والأنصار.\n\nبهذا الفوز، يواصل الفريق تسلق جدول الترتيب نحو المراتب الأولى بثبات وثقة.`
        },
        {
          locale: "fr",
          title: "Victoire précieuse de l'Espoir Sidi Hosni lors du derby régional devant un public nombreux",
          slug: "victoire-derby-regional-esh",
          content: `L'Espoir Sidi Hosni s'est imposé avec brio sur le score de deux buts à un (2-1) lors du derby régional très disputé au stade communal de Sidi Hosni.\n\nDans une ambiance festive et devant des tribunes combles, les rouge et blanc ont démontré une remarquable rigueur tactique et un engagement physique exemplaire. Les deux réalisations inscrites témoignent de la belle progression collective du groupe sous la houlette du staff technique.\n\nCette victoire capitale permet au club de consolider sa position en haut du classement.`
        }
      ]
    },
    {
      category: "الفئات الشبانية / Jeunes Catégories",
      tags: ["Formation", "Académie", "Inscriptions", "Jeunes"],
      featuredImageUrl: "/branding/esh-logo-256.png",
      publishedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      translations: [
        {
          locale: "ar",
          title: "انطلاق التسجيلات بمدرسة كرة القدم للموسم الرياضي الجديد للفئات الصغرى",
          slug: "tasjilat-madrasat-esh-koura",
          content: `تعلن إدارة نادي أمل سيدي حسني عن فتح باب التسجيلات للمواهب الشابة والبراعم للانضمام إلى مدرسة كرة القدم للفئات العمرية (U15, U17).\n\nتهدف المدرسة إلى تكوين جيل رياضي واعد وفق أحدث المعايير التربوية والتدريبية وتحت إشراف مدربين مؤهلين وحاملي شهادات تدريب معتمدة من الاتحادية الجزائرية لكرة القدم.\n\nالملفات تُودع على مستوى مقر النادي الكائن بالمركب الرياضي البلدي.`
        },
        {
          locale: "fr",
          title: "Lancement des inscriptions à l'école de football pour la nouvelle saison sportive",
          slug: "ecole-football-inscriptions-nouvelle-saison",
          content: `La direction de l'Espoir Sidi Hosni informe les parents et jeunes passionnés de l'ouverture des inscriptions pour l'école de football (catégories U15 et U17).\n\nEncadrée par des éducateurs diplômés et expérimentés, l'école propose un programme alliant formation technique, valeurs collectives et épanouissement sportif.\n\nLes dossiers d'inscription sont à retirer et déposer au secrétariat général du club au stade communal.`
        }
      ]
    },
    {
      category: "تحضيرات النادي / Préparations",
      tags: ["Stage", "Entraînement", "Séniors"],
      featuredImageUrl: "/branding/esh-logo-256.png",
      publishedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      translations: [
        {
          locale: "ar",
          title: "تربص تحضيري مغلق ناجح للفريق الأول استعداداً لمرحلة العودة الحاسمة",
          slug: "tarabos-tahdiri-esh-sidi-hosni",
          content: `اختتم الفريق الأول لنادي أمل سيدي حسني تربصه التحضيري المغلق الذي دام خمسة أيام وتخللته حصص تدريبية بدنية ومباريات تطبيقية مكثفة.\n\nوركز الطاقم الفني على معالجة النقائص التكتيكية وتعزيز الانسجام الهجومي ورفع منسوب اللياقة البدنية لدى كافة التعداد، وسط أجواء تسودها الروح العائلية والتركيز العالي لتحقيق طموحات النادي وأنصاره الأوفياء.`
        },
        {
          locale: "fr",
          title: "Stage de préparation intensif réussi pour l'équipe première en vue de la phase retour",
          slug: "stage-preparation-reussi-equipe-premiere",
          content: `L'équipe fanion de l'Espoir Sidi Hosni a achevé son stage bloqué préparatoire de cinq jours, marqué par un travail physique soutenu et des oppositions tactiques concluantes.\n\nLe staff technique s'est félicité de la discipline exemplaire du groupe et de la cohésion grandissante des joueurs, déterminés à aborder les prochaines journées de championnat avec ambition.`
        }
      ]
    },
    {
      category: "الفئات الشبانية / Jeunes Catégories",
      tags: ["U17", "Coupe", "Finale", "Exploit"],
      featuredImageUrl: "/branding/esh-logo-256.png",
      publishedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      translations: [
        {
          locale: "ar",
          title: "أشبال أمل سيدي حسني (U17) يبلغون نهائي كأس الرابطة بعد مسار بطولي",
          slug: "u17-kass-rabita-esh",
          content: `تأهلت فئة أقل من 17 سنة لأمل سيدي حسني إلى المباراة النهائية لكأس الرابطة الولائية إثر فوز عريض ومستحق في نصف النهائي بنتيجة (3-0).\n\nوقدم الأشبال أداءً كروياً راقياً أمتع الحاضرين، مؤكدين جودة التكوين القاعدي والعمل القاعدي الدؤوب الذي يقوم به الطاقم الفني لقطاع الشبان بالنادي.`
        },
        {
          locale: "fr",
          title: "Les U17 de l'ESH atteignent brillamment la finale de la Coupe de Ligue",
          slug: "u17-finale-coupe-de-ligue",
          content: `Les cadets (U17) de l'Espoir Sidi Hosni ont validé leur billet pour la grande finale de la Coupe de Ligue grâce à une brillante victoire 3-0 en demi-finale.\n\nUne performance remarquable qui témoigne de la vitalité de l'académie de l'ESH et du travail de fond accompli par les éducateurs du club.`
        }
      ]
    },
    {
      category: "الفريق الأول / Équipe Première",
      tags: ["Médical", "Effectif", "Santé"],
      featuredImageUrl: "/branding/esh-logo-256.png",
      publishedAt: new Date(Date.now() - 9 * 24 * 3600 * 1000),
      translations: [
        {
          locale: "ar",
          title: "تقرير طبي مطمئن حول جاهزية كوادر الفريق للمواجهات الرسمية القادمة",
          slug: "taqrir-tibbi-esh-sidi-hosni",
          content: `أكد طبيب النادي استعادة كافة العناصر المصابة لكامل جاهزيتهم البدنية والطبية بعد استكمال فترات التأهيل والعلاج الطبيعي.\n\nوسيعتمد الطاقم الفني على كامل التعداد في المواجهة القادمة، ما يمنح خيارات تكتيكية متعددة لتعزيز التفوق الميداني.`
        },
        {
          locale: "fr",
          title: "Bilan médical rassurant pour l'effectif avant les prochaines échéances officielles",
          slug: "bilan-medical-effectif-esh",
          content: `Le staff médical de l'Espoir Sidi Hosni a communiqué le rétablissement complet des joueurs précédemment blessés, désormais à la disposition de l'entraîneur en chef pour les prochaines journées de championnat.`
        }
      ]
    }
  ];

  for (const n of newsData) {
    await db.news.create({
      data: {
        category: n.category,
        tags: n.tags,
        featuredImageUrl: n.featuredImageUrl,
        authorId: user.id,
        status: "PUBLISHED",
        publishedAt: n.publishedAt,
        translations: {
          create: n.translations
        }
      }
    });
  }
  console.log(`Created ${newsData.length} published bilingual news articles.`);

  // 3. Announcements
  const announcementsData = [
    {
      priority: "HIGH" as const,
      startDate: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      endDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
      homepageVisibility: true,
      translations: [
        {
          locale: "ar",
          title: "مباراة القمة: انطلاق عملية بيع تذاكر لقاء الجمعة بالملعب البلدي سيدي حسني",
          content: "تعلن إدارة النادي أن عملية بيع التذاكر لمباراة أمل سيدي حسني ستنطلق صبيحة يوم الجمعة على مستوى شبابيك الملعب البلدي ابتداءً من الساعة 09:00 صباحاً. يُرجى من الجماهير الكريمة الحضور المبكر والتحلي بالروح الرياضية المعهودة."
        },
        {
          locale: "fr",
          title: "Match au sommet : ouverture de la billetterie pour la rencontre de vendredi",
          content: "La direction de l'Espoir Sidi Hosni informe les supporters que la vente des billets pour la rencontre de championnat débutera vendredi à 09h00 aux guichets du stade communal. Venez nombreux soutenir votre club !"
        }
      ]
    },
    {
      priority: "NORMAL" as const,
      startDate: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      endDate: new Date(Date.now() + 20 * 24 * 3600 * 1000),
      homepageVisibility: true,
      translations: [
        {
          locale: "ar",
          title: "الجمعية العامة العادية للنادي: عرض ومناقشة التقريرين المالي والأدبي",
          content: "يُنهى إلى علم أعضاء الجمعية العامة لنادي أمل سيدي حسني أن دورة الجمعية العامة العادية ستنعقد يوم السبت القادم بمقر قاعة المحاضرات البلدية، لمناقشة والمصادقة على الحصيلتين الأدبية والمالية للموسم."
        },
        {
          locale: "fr",
          title: "Assemblée Générale Ordinaire : présentation et adoption des bilans moral et financier",
          content: "Les membres de l'Assemblée Générale de l'ESH sont conviés à la séance ordinaire qui se tiendra samedi prochain à la salle communale des conférences pour l'examen et l'approbation des bilans moral et financier."
        }
      ]
    },
    {
      priority: "NORMAL" as const,
      startDate: new Date(Date.now() - 4 * 24 * 3600 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      homepageVisibility: true,
      translations: [
        {
          locale: "ar",
          title: "برنامج الفحوصات الطبية الدورية الشاملة لكافة لاعبي الفئات الشبانية",
          content: "تنظم اللجنة الطبية للنادي برنامج الفحص الطبي والمتابعة البدنية الدورية لكافة لاعبي الفئات الشبانية (U15 - U17 - U20) بالتنسيق مع المصالح الصحية البلدية والولائية لضمان السلامة الصحية للرياضيين."
        },
        {
          locale: "fr",
          title: "Calendrier des visites médicales et du suivi physique des jeunes catégories",
          content: "La commission médicale organise le suivi périodique et le contrôle médico-sportif des catégories jeunes (U15, U17, U20) en collaboration avec les services de santé spécialisés."
        }
      ]
    }
  ];

  for (const a of announcementsData) {
    await db.announcement.create({
      data: {
        priority: a.priority,
        startDate: a.startDate,
        endDate: a.endDate,
        homepageVisibility: a.homepageVisibility,
        status: "PUBLISHED",
        createdById: user.id,
        translations: {
          create: a.translations
        }
      }
    });
  }
  console.log(`Created ${announcementsData.length} published announcements.`);

  // 4. Matches
  const clubName = "أمل سيدي حسني (ESH)";
  const players = await db.player.findMany({ where: { status: { not: "ARCHIVED" } }, take: 14 });

  // Finished Match with FAF Connect sheet attached
  const finishedMatch = await db.match.create({
    data: {
      competitionId: competition.id,
      teamId: seniorTeam.id,
      homeTeamName: clubName,
      awayTeamName: "اتحاد واد رهيو (WRB Rahouia)",
      isHomeFixture: true,
      homeScore: 2,
      awayScore: 1,
      matchDate: new Date(Date.now() - 4 * 24 * 3600 * 1000),
      stadium: "الملعب البلدي سيدي حسني (Stade Communal)",
      refereeName: "محمد بوجمعة (حكم رابطة وهران)",
      status: "FINISHED",
      matchReport: "مباراة قوية وتنافسية تمكن خلالها أمل سيدي حسني من السيطرة على مجريات اللعب وحصد النقاط الثلاث بجدارة واستحقاق."
    }
  });

  // Add Match Events
  const p0 = players[0];
  const p1 = players[1];
  if (p0) {
    await db.matchEvent.create({
      data: {
        matchId: finishedMatch.id,
        playerId: p0.id,
        type: "GOAL",
        minute: 34,
        notes: "تسديدة قوية داخل منطقة العمليات"
      }
    });
    if (p1) {
      await db.matchEvent.create({
        data: {
          matchId: finishedMatch.id,
          playerId: p1.id,
          type: "GOAL",
          minute: 68,
          notes: "رأسية متقنة إثر ركنية"
        }
      });
      await db.matchEvent.create({
        data: {
          matchId: finishedMatch.id,
          playerId: p1.id,
          type: "YELLOW_CARD",
          minute: 82,
          notes: "تدخل لتوقيف هجمة مرتدة"
        }
      });
    }

    // Lineups
    for (let i = 0; i < Math.min(11, players.length); i++) {
      const pl = players[i];
      if (!pl) continue;
      await db.matchLineup.create({
        data: {
          matchId: finishedMatch.id,
          playerId: pl.id,
          isStarting: true,
          position: i === 0 ? "GK" : i < 5 ? "DF" : i < 9 ? "MF" : "FW"
        }
      });
    }
  }

  // Create official FAF Connect Match Sheet document linked to this match
  let reportCategory = await db.documentCategory.findFirst({
    where: { OR: [{ key: "report" }, { name: "Reports" }, { key: "administrative" }] }
  });
  if (!reportCategory) {
    reportCategory = await db.documentCategory.findFirst();
  }

  if (reportCategory) {
    await db.document.create({
      data: {
        name: `ورقة المباراة الرسمية FAF Connect — ${finishedMatch.homeTeamName} vs ${finishedMatch.awayTeamName}`,
        categoryId: reportCategory.id,
        classification: "INTERNAL",
        storageKey: `match-sheets/faf-sheet-${finishedMatch.id}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 145200,
        originalName: "feuille-de-match-officielle-faf-connect.pdf",
        ownerId: user.id,
        uploadedById: user.id,
        relatedMatchId: finishedMatch.id,
        teamId: seniorTeam.id,
        status: "APPROVED"
      }
    });
  }

  // Away Finished Match
  await db.match.create({
    data: {
      competitionId: competition.id,
      teamId: seniorTeam.id,
      homeTeamName: "اتحاد السوقر (IRB Sougueur)",
      awayTeamName: clubName,
      isHomeFixture: false,
      homeScore: 1,
      awayScore: 2,
      matchDate: new Date(Date.now() - 11 * 24 * 3600 * 1000),
      stadium: "ملعب السوقر البلدي",
      refereeName: "أحمد بن عيسى",
      status: "FINISHED",
      matchReport: "فوز ثمين خارج الديار بعد شوط ثانٍ بطولي وتألق خط الدفاع وحارس المرمى."
    }
  });

  // Scheduled Upcoming Matches
  await db.match.create({
    data: {
      competitionId: competition.id,
      teamId: seniorTeam.id,
      homeTeamName: clubName,
      awayTeamName: "شباب دحموني (CRB Dahmouni)",
      isHomeFixture: true,
      matchDate: new Date(Date.now() + 4 * 24 * 3600 * 1000),
      stadium: "الملعب البلدي سيدي حسني",
      refereeName: "سفيان زروقي (حكم رئيسي)",
      status: "SCHEDULED"
    }
  });

  await db.match.create({
    data: {
      competitionId: competition.id,
      teamId: seniorTeam.id,
      homeTeamName: "شبيبة سيدي حسني (JS Sidi Hosni)",
      awayTeamName: clubName,
      isHomeFixture: false,
      matchDate: new Date(Date.now() + 11 * 24 * 3600 * 1000),
      stadium: "الملعب البلدي",
      status: "SCHEDULED"
    }
  });
  console.log("Created 4 realistic matches (2 finished with FAF sheet and events, 2 scheduled).");

  // 5. Photo Albums & Media
  const album1 = await db.album.create({
    data: {
      name: "أجواء الفوز بالديربي والاحتفالات مع الأنصار",
      description: "صور حصرية من كواليس المواجهة واحتفالات اللاعبين مع الجمهور الرياضي في المدرجات",
      category: "MATCHES",
      teamId: seniorTeam.id,
      published: true,
      coverImageUrl: "/branding/esh-logo-256.png",
      createdById: user.id,
      media: {
        create: [
          {
            url: "/branding/esh-logo-256.png",
            storageKey: "gallery/derby-celebration-1.jpg",
            caption: "فرحة تسجيل الهدف الثاني وحسم اللقاء",
            order: 0
          },
          {
            url: "/branding/esh-logo-256.png",
            storageKey: "gallery/derby-celebration-2.jpg",
            caption: "تحية الجمهور والأنصار الأوفياء في نهاية المباراة",
            order: 1
          }
        ]
      }
    }
  });

  const album2 = await db.album.create({
    data: {
      name: "الحصص التدريبية والتحضيرات الميدانية",
      description: "لقطات من التدريبات الفنية والبدنية للاعبي الفريق الأول بالملعب البلدي لسيدي حسني",
      category: "TRAINING",
      teamId: seniorTeam.id,
      published: true,
      coverImageUrl: "/branding/esh-logo-256.png",
      createdById: user.id,
      media: {
        create: [
          {
            url: "/branding/esh-logo-256.png",
            storageKey: "gallery/training-session-1.jpg",
            caption: "تركيز وانضباط تكتيكي في الحصة المسائية",
            order: 0
          }
        ]
      }
    }
  });

  console.log(`Created 2 photo albums (${album1.id}, ${album2.id}).`);
  console.log("Demo data generation completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
