const tuitionsType = {
    HOME_TUITION: "HOME_TUITION",
    ONLINE_TUITION: "ONLINE_TUITION"
}
const WorkModes = {
    FULL_MANAGEMENT: "FULL_MANAGEMENT",
    CREDIT_BASED: "CREDIT_BASED",
}
const genders = {
    male: "MALE",
    female: "FEMALE",
    noPreference: "NO_PREFERENCE",
}
const leadCreate = {
    byApp: "CREATED_SELF",
    byAdmin: "CREATED_ADMIN"
}
const sortOrder = {
    asc: 'asc',
    desc: 'desc'
}
const studentStatus = {
    pending: "PENDING",
    complete: "COMPLETED"
}
const userType = {
    traveller: "TRAVELLER",
    vendor: "VENDOR",
    companion: "COMPANION"
}

const feedbackStatus = {
    POSITIVE: "POSITIVE",
    NEGATIVE: "NEGATIVE"
}

const issueStatus = {
    FEEDBACK_DONE: "FEEDBACK_DONE",
    ISSUE_RESOLVED: "ISSUE_RESOLVED"
}

const demoStatus = {
    PENDING: 0,              // Demo pending
    APPROVED: 1,             // Demo approved
    REJECTED: 2,             // Demo rejected
    PENDING_FOR_TUTOR: 3,    // Demo pending for tutor side
    ACCEPTED_FOR_TUTOR: 4,   // Demo accepted for tutor side
    REJECTED_FOR_TUTOR: 5,   // Demo rejected for tutor side
    DEMO_TAKEN: 6,           // Demo taken by tutor or feedback pending for parent side
    APPROVED_FOR_STUDENT: 7, // Demo approved for parent side
    REJECTED_FOR_STUDENT: 8, // Demo rejected for parent side
    ONGOING_TUITION: 9,      // Demo converted to ongoing tuition
    CHANGE_TUTOR: 10,        // Change tutor request for parent side
    CLOSE_TUITION: 11,       // Close tuition class
    Tuition_Hold: 12        // Class hold by admin or parent
}

const creditBaseDemoStatus = {
    PENDING: 0,              // Demo pending
    APPROVED: 1,             // Demo approved
    REJECTED: 2,             // Demo rejected
}

const tAndConType = {
    TUTOR: "TUTOR",
    PARENT: "PARENT",
    PRIVACY_POLICY: "PRIVACY_POLICY",
    Terms_AND_Condition: "Terms&Condition",
    REFERRAL: "REFERRAL",
    LOGIN_PRIVACY_POLICY: "LOGIN_PRIVACY_POLICY",
    LOGIN_Terms_AND_Condition: "LOGIN_Terms&Condition",
    REFUND_AND_CANCELLATION_POLICY: "REFUND_AND_CANCELLATION_POLICY"
}

const workingMode = {
    MANAGEMENT: "MANAGEMENT_MODEL",
    PAY_AND_VIEW: "PAY_AND_VIEW_MODEL"

}
module.exports = {
    tuitionsType,
    WorkModes,
    genders,
    userType,
    sortOrder,
    leadCreate,
    studentStatus,
    demoStatus,
    tAndConType,
    workingMode,
    feedbackStatus,
    issueStatus,
    creditBaseDemoStatus
}