const ROLES_BRIEF = {
    SUPER_ADMIN: {
        roleId: 1,
        name: "SUPER ADMIN",
        accessURL: []
    },
    ADMIN: {
        roleId: 2,
        name: "ADMIN",
        accessURL: []
    },
};


const ROLES = {
    SUPER_ADMIN: 1,
    ADMIN: 2
}


const ROLES_RES = {
    1: "SUPER_ADMIN",
    2: "ADMIN"
}


module.exports = {
    ROLES,
    ROLES_BRIEF,
    ROLES_RES
};