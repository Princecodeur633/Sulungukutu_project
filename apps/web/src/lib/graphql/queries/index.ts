import { gql } from '@apollo/client';

// ── Auth ──────────────────────────────────────────────────────
export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      profile {
        id
        code
        nom
        prenom
        email
        avatarUrl
      }
      currentMembership {
        id
        role
        code
        school { id nom logoUrl anneeScolaire }
      }
      availableMemberships {
        id
        role
        code
        status
        school { id nom logoUrl anneeScolaire }
      }
    }
  }
`;

export const SWITCH_WORKSPACE_MUTATION = gql`
  mutation SwitchWorkspace($schoolId: ID!) {
    switchWorkspace(schoolId: $schoolId) {
      accessToken
      refreshToken
      membership {
        id
        role
        code
        school { id nom logoUrl anneeScolaire }
      }
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      code
      nom
      prenom
      email
      phone
      avatarUrl
      memberships {
        id
        role
        code
        status
        school { id nom logoUrl }
      }
    }
  }
`;

// ── Dashboards ────────────────────────────────────────────────
export const ADMIN_DASHBOARD_QUERY = gql`
  query AdminDashboard($schoolId: ID!) {
    adminDashboard(schoolId: $schoolId) {
      totalStudents
      totalTeachers
      totalParents
      totalClasses
      presentToday
      absentToday
      unpaidCurrentMonth
      classPerformance {
        class { id nom }
        moyenneGenerale
      }
      gradeEvolution {
        trimestre
        moyenne
        nbEleves
      }
      mentionDistribution {
        mention
        count
        color
      }
      recentAuditLogs {
        id action description entityType createdAt
        actor { code profile { nom prenom } }
      }
    }
  }
`;

export const TEACHER_DASHBOARD_QUERY = gql`
  query TeacherDashboard($schoolId: ID!) {
    teacherDashboard(schoolId: $schoolId) {
      totalStudents
      classSubjectsToday {
        id
        class { id nom level { nom } }
        subject { id nom }
        schedules { jour heureDebut heureFin salle }
      }
      myClasses {
        id nom
        studentCount
        level { nom }
      }
      recentGrades {
        id valeur typeEval trimestre dateSaisie
        student { membership { profile { nom prenom } } }
        classSubject { subject { nom } class { nom } }
      }
      pendingAttendance {
        id
        class { nom }
        subject { nom }
        schedules { jour heureDebut heureFin salle }
      }
      weeklyAbsences {
        jour absences presents total
      }
      studentsAtRisk {
        moyenne absenceCount
        student {
          id
          class { nom }
          membership { profile { nom prenom } }
        }
      }
    }
  }
`;

export const PARENT_DASHBOARD_QUERY = gql`
  query ParentDashboard($schoolId: ID!) {
    parentDashboard(schoolId: $schoolId) {
      unreadMessages
      unreadNotifications
      children {
        student {
          id
          matricule
          class { nom level { nom } }
          membership {
            profile { nom prenom avatarUrl }
          }
        }
        moyenneGenerale
        presenceRate
        currentMonthPayment { mois statut }
        unpaidMonths { mois statut }
      }
    }
  }
`;

// ── Classes ───────────────────────────────────────────────────
export const CLASSES_BY_SCHOOL_QUERY = gql`
  query ClassesBySchool($schoolId: ID!, $levelId: ID) {
    classesBySchool(schoolId: $schoolId, levelId: $levelId) {
      id
      nom
      anneeScolaire
      studentCount
      level { id nom type }
      classSubjects {
        id
        coefficient
        subject { id nom }
        teacher { id code profile { nom prenom } }
      }
    }
  }
`;

export const CREATE_CLASS_MUTATION = gql`
  mutation CreateClass($input: CreateClassInput!) {
    createClass(input: $input) {
      id
      nom
      anneeScolaire
      level { id nom }
    }
  }
`;


export const UPDATE_CLASS_MUTATION = gql`
  mutation UpdateClass($id: ID!, $input: UpdateClassInput!) {
    updateClass(id: $id, input: $input) { id nom anneeScolaire }
  }
`;

export const DELETE_CLASS_MUTATION = gql`
  mutation DeleteClass($id: ID!) {
    deleteClass(id: $id)
  }
`;

export const REMOVE_CLASS_SUBJECT_MUTATION = gql`
  mutation RemoveClassSubject($id: ID!) {
    removeClassSubject(id: $id)
  }
`;

// ── Élèves ────────────────────────────────────────────────────
export const STUDENTS_BY_CLASS_QUERY = gql`
  query StudentsByClass($classId: ID!, $pagination: PaginationInput) {
    studentsByClass(classId: $classId, pagination: $pagination) {
      data {
        id
        matricule
        sexe
        dateNaissance
        class { id nom level { id nom } }
        membership {
          id
          code
          status
          profile { id nom prenom email phone avatarUrl }
        }
        parents {
          lien
          parent { profile { nom prenom phone } }
        }
      }
      pageInfo {
        totalCount
        currentPage
        totalPages
        hasNextPage
      }
    }
  }
`;

export const CREATE_STUDENT_MUTATION = gql`
  mutation CreateStudent($input: CreateStudentInput!) {
    createStudent(input: $input) {
      id
      matricule
      tempPassword
      parentTempPassword
      membership {
        id
        code
        profile { id nom prenom email code phone }
      }
      parents {
        lien
        parent {
          id
          code
          profile { id nom prenom email code phone }
        }
      }
    }
  }
`;

export const LINK_PARENT_STUDENT_MUTATION = gql`
  mutation LinkParentStudent($input: LinkParentStudentInput!) {
    linkParentStudent(input: $input) {
      id
      lien
      parent { id code profile { nom prenom email phone } }
    }
  }
`;

export const STUDENT_STATS_QUERY = gql`
  query StudentStats($studentId: ID!, $anneeScolaire: String!) {
    studentStats(studentId: $studentId, anneeScolaire: $anneeScolaire) {
      student {
        id
        matricule
        membership { profile { nom prenom email avatarUrl } }
        class { nom }
      }
      moyennesParMatiere {
        classSubject { subject { nom } coefficient }
        moyenne
        trimestre
      }
      moyennesParTrimestre {
        trimestre
        moyenne
      }
      absencesParMois {
        mois
        count
      }
      rang
      mention
    }
  }
`;

// ── Notes ─────────────────────────────────────────────────────
export const GRADES_BY_CLASS_QUERY = gql`
  query GradesByClass($classId: ID!, $trimestre: Trimester!) {
    gradesByClass(classId: $classId, trimestre: $trimestre) {
      id valeur typeEval trimestre dateSaisie
      student {
        id
        membership { profile { nom prenom } }
      }
      classSubject {
        id coefficient
        subject { id nom }
      }
    }
  }
`;

export const GRADES_BY_CLASS_SUBJECT_QUERY = gql`
  query GradesByClassSubject($classSubjectId: ID!, $trimestre: Trimester) {
    gradesByClassSubject(classSubjectId: $classSubjectId, trimestre: $trimestre) {
      id
      valeur
      typeEval
      trimestre
      dateSaisie
      student {
        id
        matricule
        membership { profile { nom prenom } }
      }
    }
  }
`;

export const UPDATE_GRADE_MUTATION = gql`
  mutation UpdateGrade($id: ID!, $input: UpdateGradeInput!) {
    updateGrade(id: $id, input: $input) { id valeur typeEval trimestre }
  }
`;

export const BULK_CREATE_GRADES_MUTATION = gql`
  mutation BulkCreateGrades($input: BulkCreateGradesInput!) {
    bulkCreateGrades(input: $input) {
      id
      valeur
      typeEval
      trimestre
      student { id membership { profile { nom prenom } } }
    }
  }
`;

// ── Présences ─────────────────────────────────────────────────
export const MARK_ATTENDANCE_MUTATION = gql`
  mutation MarkAttendance($input: MarkAttendanceInput!) {
    markAttendance(input: $input) {
      id
      statut
      date
      student { id membership { profile { nom prenom } } }
    }
  }
`;

export const ATTENDANCE_BY_CLASS_SUBJECT_QUERY = gql`
  query AttendanceByClassSubject($classSubjectId: ID!, $date: String!) {
    attendanceByClassSubject(classSubjectId: $classSubjectId, date: $date) {
      id
      studentId
      statut
      motif
      date
      student {
        id
        membership { profile { nom prenom avatarUrl } }
      }
    }
  }
`;

// ── Paiements ─────────────────────────────────────────────────
export const PAYMENTS_BY_STUDENT_QUERY = gql`
  query PaymentsByStudent($studentId: ID!, $anneeScolaire: String!) {
    paymentsByStudent(studentId: $studentId, anneeScolaire: $anneeScolaire) {
      student { id }
      anneeScolaire
      t1Unlocked
      t2Unlocked
      t3Unlocked
      totalPaid
      totalUnpaid
      moisDetails {
        id
        mois
        statut
        datePaiement
        recuUrl
        montantDu
        montantPaye
      }
    }
  }
`;

export const UPDATE_PAYMENT_STATUS_MUTATION = gql`
  mutation UpdatePaymentStatus($input: UpdatePaymentStatusInput!) {
    updatePaymentStatus(input: $input) {
      id
      mois
      statut
      datePaiement
    }
  }
`;

// Encaissement en présentiel (guichet) — espèces ou autre moyen local
export const RECORD_MANUAL_PAYMENT_MUTATION = gql`
  mutation RecordManualPayment($input: RecordManualPaymentInput!) {
    recordManualPayment(input: $input) {
      transaction {
        id
        montant
        mode
        statut
        numeroRecu
        recuUrl
        createdAt
      }
      payment {
        id
        mois
        statut
        montantDu
        montantPaye
        recuUrl
      }
    }
  }
`;

export const CANCEL_PAYMENT_TRANSACTION_MUTATION = gql`
  mutation CancelPaymentTransaction($input: CancelPaymentTransactionInput!) {
    cancelPaymentTransaction(input: $input) {
      transaction { id statut }
      payment { id mois statut montantDu montantPaye }
    }
  }
`;

export const PAYMENT_TRANSACTION_HISTORY_QUERY = gql`
  query PaymentTransactionHistory($studentId: ID!, $anneeScolaire: String) {
    paymentTransactionHistory(studentId: $studentId, anneeScolaire: $anneeScolaire) {
      id
      montant
      devise
      mode
      canal
      statut
      codeEchec
      numeroTelephone
      numeroRecu
      transactionRef
      observations
      recuUrl
      createdAt
      agent { profile { nom prenom } }
      payment { mois }
    }
  }
`;

// Paiement à distance simulé (Mobile Money, XAF) — portail parent/élève
export const INITIATE_REMOTE_PAYMENT_MUTATION = gql`
  mutation InitiateRemotePayment($input: InitiateRemotePaymentInput!) {
    initiateRemotePayment(input: $input) {
      transaction {
        id
        statut
        codeEchec
        numeroRecu
        transactionRef
        recuUrl
      }
      payment {
        id
        mois
        statut
        montantDu
        montantPaye
        recuUrl
      }
    }
  }
`;

// ── Bulletins ─────────────────────────────────────────────────
export const BULLETINS_BY_STUDENT_QUERY = gql`
  query BulletinsByStudent($studentId: ID!, $anneeScolaire: String!) {
    bulletinsByStudent(studentId: $studentId, anneeScolaire: $anneeScolaire) {
      id
      trimestre
      statut
      pdfUrl
      moyenneGenerale
      rang
      mention
      isDownloadable
      generatedAt
      details {
        moyenneMatiere
        coefficient
        pointsObtenus
        appreciation
        classSubject {
          id
          subject { id nom }
        }
      }
    }
  }
`;

export const GENERATE_BULLETINS_MUTATION = gql`
  mutation GenerateBulletins($input: GenerateBulletinsInput!) {
    generateBulletins(input: $input) {
      id
      trimestre
      statut
      moyenneGenerale
      mention
      student {
        id
        matricule
        membership { profile { nom prenom } }
      }
    }
  }
`;

// ── Audit Log ─────────────────────────────────────────────────
export const AUDIT_LOGS_QUERY = gql`
  query AuditLogs($filter: AuditLogFilter!, $pagination: PaginationInput) {
    auditLogs(filter: $filter, pagination: $pagination) {
      data {
        id
        action
        entityType
        entityId
        description
        oldValue
        newValue
        createdAt
        actor {
          id
          code
          role
          profile { nom prenom avatarUrl }
        }
      }
      pageInfo {
        totalCount
        currentPage
        totalPages
        hasNextPage
      }
    }
  }
`;

// ── Messages ─────────────────────────────────────────────────
export const MY_MESSAGES_QUERY = gql`
  query MyMessages($schoolId: ID!, $pagination: PaginationInput) {
    myMessages(schoolId: $schoolId, pagination: $pagination) {
      data {
        id
        sujet
        contenu
        lu
        createdAt
        sender { id profile { nom prenom avatarUrl } }
        receiver { id profile { nom prenom avatarUrl } }
      }
      pageInfo { totalCount hasNextPage }
    }
  }
`;

export const SEND_MESSAGE_MUTATION = gql`
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      sujet
      contenu
      createdAt
    }
  }
`;

// ── Notifications ─────────────────────────────────────────────
export const MY_NOTIFICATIONS_QUERY = gql`
  query MyNotifications($pagination: PaginationInput) {
    myNotifications(pagination: $pagination) {
      data {
        id
        titre
        message
        type
        lu
        createdAt
        school { nom }
      }
      pageInfo { totalCount hasNextPage }
    }
  }
`;

export const UNREAD_COUNTS_QUERY = gql`
  query UnreadCounts($schoolId: ID!) {
    unreadMessageCount(schoolId: $schoolId)
    unreadNotificationCount
  }
`;

// ── Subscriptions ─────────────────────────────────────────────
export const NOTIFICATION_ADDED_SUBSCRIPTION = gql`
  subscription NotificationAdded($profileId: ID!) {
    notificationAdded(profileId: $profileId) {
      id
      titre
      message
      type
      lu
      createdAt
    }
  }
`;

export const MESSAGE_RECEIVED_SUBSCRIPTION = gql`
  subscription MessageReceived($schoolId: ID!, $membershipId: ID!) {
    messageReceived(schoolId: $schoolId, membershipId: $membershipId) {
      id
      sujet
      contenu
      lu
      createdAt
      sender { id profile { nom prenom } }
      receiver { id profile { nom prenom } }
    }
  }
`;

export const BULLETIN_STATUS_CHANGED_SUBSCRIPTION = gql`
  subscription BulletinStatusChanged($studentId: ID!) {
    bulletinStatusChanged(studentId: $studentId) {
      id
      trimestre
      statut
    }
  }
`;

// ── Student Dashboard ─────────────────────────────────────────
export const STUDENT_DASHBOARD_QUERY = gql`
  query StudentDashboard($schoolId: ID!) {
    studentDashboard(schoolId: $schoolId) {
      recentGrades {
        id valeur typeEval trimestre dateSaisie
        classSubject { subject { nom } coefficient }
      }
      upcomingSchedule {
        id jour heureDebut heureFin salle
        classSubject {
          subject { nom }
          teacher { profile { nom prenom } }
        }
      }
      recentAbsences {
        id date statut motif
        classSubject { subject { nom } }
      }
      announcements {
        id titre contenu createdAt cible
      }
    }
  }
`;

// ── Student queries ───────────────────────────────────────────
export const MY_STUDENT_PROFILE_QUERY = gql`
  query MyStudentProfile($schoolId: ID!) {
    myStudentProfile(schoolId: $schoolId) {
      id
      matricule
      dateNaissance
      sexe
      membership { profile { nom prenom email } }
      class { id nom level { nom } }
    }
  }
`;

export const MY_GRADES_QUERY = gql`
  query MyGrades($filter: GradeFilter!, $pagination: PaginationInput) {
    gradesByStudent(filter: $filter, pagination: $pagination) {
      data {
        id valeur typeEval trimestre dateSaisie
        classSubject { coefficient subject { nom } }
      }
      pageInfo { totalCount }
    }
  }
`;

export const MY_ATTENDANCE_QUERY = gql`
  query MyAttendance($filter: AttendanceFilter!, $pagination: PaginationInput) {
    attendanceByStudent(filter: $filter, pagination: $pagination) {
      data {
        id date statut motif
        classSubject { subject { nom } }
      }
      pageInfo { totalCount }
    }
  }
`;

// ── Parent enriched ───────────────────────────────────────────
export const CHILD_SUMMARY_QUERY = gql`
  query ChildSummary($studentId: ID!) {
    childSummary(studentId: $studentId) {
      moyenneGenerale
      presenceRate
      unpaidMonths { id mois statut recuUrl montantDu montantPaye }
      currentMonthPayment { id mois statut montantDu montantPaye }
      recentGrades {
        id valeur typeEval trimestre dateSaisie
        classSubject { subject { nom } coefficient }
      }
      recentAbsences {
        id date statut motif
        classSubject { subject { nom } }
      }
      allGrades {
        id valeur typeEval trimestre dateSaisie
        classSubject {
          coefficient
          subject { nom }
          teacher { profile { nom prenom } }
        }
      }
      allAttendances {
        id date statut motif
        classSubject { subject { nom } }
      }
      student {
        id matricule dateNaissance sexe
        membership { profile { nom prenom email phone } }
        class { nom level { nom } }
        parents { lien parent { profile { nom prenom } } }
      }
    }
  }
`;

// ── Niveaux ───────────────────────────────────────────────────
export const LEVELS_BY_SCHOOL_QUERY = gql`
  query LevelsBySchool($schoolId: ID!) {
    levelsBySchool(schoolId: $schoolId) { id nom type ordre }
  }
`;

// ── Matières ─────────────────────────────────────────────────
export const SUBJECTS_BY_SCHOOL_QUERY = gql`
  query SubjectsBySchool($schoolId: ID!) {
    subjectsBySchool(schoolId: $schoolId) { id nom description }
  }
`;

// ── Membres ───────────────────────────────────────────────────
export const SCHOOL_MEMBERS_QUERY = gql`
  query SchoolMembers($schoolId: ID!, $role: Role, $pagination: PaginationInput) {
    schoolMembers(schoolId: $schoolId, role: $role, pagination: $pagination) {
      data {
        id code role status joinedAt
        profile { id nom prenom email phone avatarUrl }
      }
      pageInfo { totalCount currentPage totalPages hasNextPage hasPreviousPage }
    }
  }
`;


export const GLOBAL_SEARCH_QUERY = gql`
  query GlobalSearch($schoolId: ID!, $query: String!) {
    globalSearch(schoolId: $schoolId, query: $query) {
      type id label sublabel href
    }
  }
`;

export const SEARCH_MEMBERS_QUERY = gql`
  query SearchMembers($schoolId: ID!, $query: String, $role: Role) {
    searchMembers(schoolId: $schoolId, query: $query, role: $role) {
      id role code
      profile { nom prenom avatarUrl }
    }
  }
`;

// ── Emploi du temps ───────────────────────────────────────────
export const SCHEDULE_BY_CLASS_QUERY = gql`
  query ScheduleByClass($classId: ID!) {
    scheduleByClass(classId: $classId) {
      id jour heureDebut heureFin salle
      classSubject {
        id subject { nom }
        teacher { profile { nom prenom } }
      }
    }
  }
`;

// Emploi du temps d'un enseignant précis — vérification préventive de
// conflit AVANT la création d'un créneau (côté admin).
export const SCHEDULE_BY_TEACHER_MEMBERSHIP_QUERY = gql`
  query ScheduleByTeacherMembership($teacherMembershipId: ID!) {
    scheduleByTeacherMembership(teacherMembershipId: $teacherMembershipId) {
      id jour heureDebut heureFin
      classSubject { class { nom } subject { nom } }
    }
  }
`;

// ── Annonces ─────────────────────────────────────────────────
export const ANNOUNCEMENTS_QUERY = gql`
  query AnnouncementsBySchool($schoolId: ID!) {
    announcementsBySchool(schoolId: $schoolId) {
      id titre contenu cible createdAt
      auteur { profile { nom prenom } }
    }
  }
`;

// ── Bulletins par classe ──────────────────────────────────────
export const BULLETINS_BY_CLASS_QUERY = gql`
  query BulletinsByClass($classId: ID!, $trimestre: Trimester!, $anneeScolaire: String!) {
    bulletinsByClass(classId: $classId, trimestre: $trimestre, anneeScolaire: $anneeScolaire) {
      id trimestre statut moyenneGenerale rang mention isDownloadable pdfUrl generatedAt
      student {
        id matricule
        membership { profile { nom prenom } }
      }
      details {
        moyenneMatiere coefficient appreciation
        classSubject { subject { nom } }
      }
    }
  }
`;

// ── Matières par classe ───────────────────────────────────────
export const CLASS_SUBJECTS_BY_CLASS_QUERY = gql`
  query ClassSubjectsByClass($classId: ID!) {
    classSubjectsByClass(classId: $classId) {
      id coefficient hoursPerWeek
      subject { id nom }
      teacher { id code profile { nom prenom } }
      schedules { id jour heureDebut heureFin salle }
    }
  }
`;

export const CLASS_SUBJECTS_BY_TEACHER_QUERY = gql`
  query ClassSubjectsByTeacher($schoolId: ID!) {
    classSubjectsByTeacher(schoolId: $schoolId) {
      id coefficient hoursPerWeek
      class { id nom level { nom } }
      subject { id nom }
      schedules { jour heureDebut heureFin salle }
    }
  }
`;

// ── Mutations supplémentaires ─────────────────────────────────
export const CREATE_LEVEL_MUTATION = gql`
  mutation CreateLevel($input: CreateLevelInput!) {
    createLevel(input: $input) { id nom type ordre }
  }
`;

export const CREATE_SUBJECT_MUTATION = gql`
  mutation CreateSubject($input: CreateSubjectInput!) {
    createSubject(input: $input) { id nom description }
  }
`;

export const UPDATE_SUBJECT_MUTATION = gql`
  mutation UpdateSubject($id: ID!, $input: UpdateSubjectInput!) {
    updateSubject(id: $id, input: $input) { id nom description }
  }
`;

export const DELETE_SUBJECT_MUTATION = gql`
  mutation DeleteSubject($id: ID!) { deleteSubject(id: $id) }
`;

export const ASSIGN_CLASS_SUBJECT_MUTATION = gql`
  mutation AssignClassSubject($input: AssignClassSubjectInput!) {
    assignClassSubject(input: $input) {
      id coefficient
      subject { nom }
      teacher { profile { nom prenom } }
    }
  }
`;

export const INVITE_USER_MUTATION = gql`
  mutation InviteUser($input: InviteUserInput!) {
    inviteUser(input: $input) {
      tempPassword
      membership { id code role profile { nom prenom email code phone } }
    }
  }
`;

export const CREATE_ANNOUNCEMENT_MUTATION = gql`
  mutation CreateAnnouncement($input: CreateAnnouncementInput!) {
    createAnnouncement(input: $input) { id titre cible createdAt }
  }
`;

export const DELETE_ANNOUNCEMENT_MUTATION = gql`
  mutation DeleteAnnouncement($id: ID!) { deleteAnnouncement(id: $id) }
`;

export const UPDATE_SCHEDULE_MUTATION = gql`
  mutation UpdateSchedule($id: ID!, $input: UpdateScheduleInput!) {
    updateSchedule(id: $id, input: $input) { id jour heureDebut heureFin salle }
  }
`;

export const CREATE_SCHEDULE_MUTATION = gql`
  mutation CreateSchedule($input: CreateScheduleInput!) {
    createSchedule(input: $input) { id jour heureDebut heureFin salle }
  }
`;

export const DELETE_SCHEDULE_MUTATION = gql`
  mutation DeleteSchedule($id: ID!) { deleteSchedule(id: $id) }
`;

export const PUBLISH_BULLETIN_MUTATION = gql`
  mutation PublishBulletin($id: ID!) { publishBulletin(id: $id) { id statut } }
`;

export const REGENERATE_BULLETIN_MUTATION = gql`
  mutation RegenerateBulletin($id: ID!) {
    regenerateBulletin(id: $id) { id statut moyenneGenerale }
  }
`;

export const MARK_MESSAGE_READ_MUTATION = gql`
  mutation MarkMessageRead($id: ID!) { markMessageAsRead(id: $id) { id lu } }
`;

export const MARK_ALL_MESSAGES_READ_MUTATION = gql`
  mutation MarkAllMessagesRead($schoolId: ID!) { markAllMessagesAsRead(schoolId: $schoolId) }
`;

export const MARK_NOTIFICATION_READ_MUTATION = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationAsRead(id: $id) { id lu }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ_MUTATION = gql`
  mutation MarkAllNotificationsRead { markAllNotificationsAsRead }
`;

export const DELETE_NOTIFICATION_MUTATION = gql`
  mutation DeleteNotification($id: ID!) { deleteNotification(id: $id) }
`;

export const TRANSFER_STUDENT_MUTATION = gql`
  mutation TransferStudent($studentId: ID!, $newClassId: ID!) {
    transferStudentClass(studentId: $studentId, newClassId: $newClassId) {
      id
      class { id nom level { id nom } }
    }
  }
`;

export const UPDATE_STUDENT_MUTATION = gql`
  mutation UpdateStudent($id: ID!, $input: UpdateStudentInput!) {
    updateStudent(id: $id, input: $input) { id matricule }
  }
`;

// ── Profil & Auth ─────────────────────────────────────────────
export const UPDATE_PROFILE_MUTATION = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id nom prenom email phone avatarUrl
    }
  }
`;

export const REQUEST_PASSWORD_RESET_MUTATION = gql`
  mutation RequestPasswordReset($identifiant: String!) {
    requestPasswordReset(identifiant: $identifiant)
  }
`;

export const CONFIRM_PASSWORD_RESET_MUTATION = gql`
  mutation ConfirmPasswordReset($token: String!, $newPassword: String!) {
    confirmPasswordReset(token: $token, newPassword: $newPassword)
  }
`;

export const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken($token: String!) {
    refreshToken(token: $token) {
      accessToken
      refreshToken
      currentMembership {
        id
        role
        school { id nom }
      }
    }
  }
`;

export const ADMIN_RESET_PASSWORD_MUTATION = gql`
  mutation AdminResetPassword($membershipId: ID!) {
    adminResetPassword(membershipId: $membershipId) {
      tempPassword
      hasRealEmail
    }
  }
`;

// Annuaire des identifiants (jamais de mot de passe — utiliser
// ADMIN_RESET_PASSWORD_MUTATION pour en générer un nouveau à communiquer).
export const USERS_DIRECTORY_QUERY = gql`
  query UsersDirectory($schoolId: ID) {
    usersDirectory(schoolId: $schoolId) {
      membershipId
      code
      matricule
      nom
      prenom
      email
      phone
      role
      status
      schoolName
      joinedAt
    }
  }
`;

export const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input)
  }
`;

// ── Super Admin ───────────────────────────────────────────────
export const SUPER_ADMIN_DASHBOARD_QUERY = gql`
  query SuperAdminDashboard {
    superAdminDashboard {
      totalSchools
      totalProfiles
      recentSchools {
        id code nom adresse telephone createdAt
      }
    }
  }
`;

export const ALL_SCHOOLS_QUERY = gql`
  query AllSchools($pagination: PaginationInput) {
    allSchools(pagination: $pagination) {
      data {
        id code nom adresse telephone logoUrl anneeScolaire accentColor createdAt
      }
      pageInfo { totalCount currentPage totalPages hasNextPage hasPreviousPage }
    }
  }
`;

export const MY_SCHOOL_QUERY = gql`
  query MySchool($schoolId: ID!) {
    mySchool(schoolId: $schoolId) {
      id nom anneeScolaire accentColor logoUrl
    }
  }
`;

export const SCHOOL_BY_ID_QUERY = gql`
  query SchoolById($schoolId: ID!) {
    schoolById(id: $schoolId) {
      id code nom adresse telephone logoUrl anneeScolaire accentColor createdAt
    }
  }
`;

export const SCHOOL_DETAIL_QUERY = gql`
  query SchoolDetail($schoolId: ID!) {
    schoolById(id: $schoolId) {
      id code nom adresse telephone logoUrl anneeScolaire accentColor createdAt
    }
    adminDashboard(schoolId: $schoolId) {
      totalStudents totalTeachers totalParents totalClasses
    }
    schoolMembers(schoolId: $schoolId, role: ADMIN, pagination: { page: 1, limit: 20 }) {
      data {
        id status role
        profile { id prenom nom email }
      }
    }
  }
`;

export const CREATE_SCHOOL_MUTATION = gql`
  mutation CreateSchool($input: CreateSchoolInput!) {
    createSchool(input: $input) {
      school { id code nom }
      adminIdentifiant
      adminTempPassword
      hasRealEmail
    }
  }
`;

export const UPDATE_SCHOOL_MUTATION = gql`
  mutation UpdateSchoolBySuper($schoolId: ID!, $input: UpdateSchoolInput!) {
    updateSchoolBySuper(schoolId: $schoolId, input: $input) {
      id nom adresse telephone
    }
  }
`;

export const ALL_PROFILES_QUERY = gql`
  query AllProfiles($pagination: PaginationInput) {
    allProfiles(pagination: $pagination) {
      data {
        id code nom prenom email phone avatarUrl isSuperAdmin createdAt
        memberships {
          id role status
          school { id nom }
          studentProfile { matricule }
        }
      }
      pageInfo { totalCount currentPage totalPages hasNextPage hasPreviousPage }
    }
  }
`;

export const UPDATE_ANNOUNCEMENT_MUTATION = gql`
  mutation UpdateAnnouncement($id: ID!, $input: CreateAnnouncementInput!) {
    updateAnnouncement(id: $id, input: $input) { id titre cible }
  }
`;

export const UPDATE_MEMBERSHIP_STATUS_MUTATION = gql`
  mutation UpdateMembershipStatus($input: UpdateMembershipStatusInput!) {
    updateMembershipStatus(input: $input) {
      id status role
    }
  }
`;

export const CLASS_SUBJECTS_WITH_GRADES_QUERY = gql`
  query ClassSubjectsWithGrades($classId: ID!) {
    classSubjectsByClass(classId: $classId) {
      id coefficient
      subject { id nom }
      teacher { id profile { nom prenom } }
      grades {
        id valeur typeEval trimestre dateSaisie
        student { id matricule membership { profile { nom prenom } } }
      }
    }
  }
`;


export const CLASS_SUBJECTS_BY_TEACHER_FILTER_QUERY = gql`
  query ClassSubjectsByTeacherInSchool($schoolId: ID!, $membershipId: ID!) {
    classSubjectsByTeacher(schoolId: $schoolId) {
      id coefficient
      class { nom }
      subject { nom }
    }
  }
`;

// ── Génération PDF bulletin ───────────────────────────────────
export const GENERATE_BULLETIN_PDF_MUTATION = gql`
  mutation GenerateBulletinPdf($bulletinId: ID!) {
    generateBulletinPdf(bulletinId: $bulletinId) {
      id pdfUrl isDownloadable
    }
  }
`;
