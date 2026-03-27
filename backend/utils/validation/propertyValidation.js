const Joi = require("joi");

const residentialTypes = [
    "apartment",
    "townhouse",
    "villa-compound",
    "land",
    "building",
    "villa",
    "penthouse",
    "hotel-apartment",
    "floor",
    "studio",
];

const commercialTypes = [
    "office",
    "warehouse",
    "industrial-land",
    "showroom",
    "shop",
    "labour-camp",
    "bulk-unit",
    "factory",
    "mixed-use-land",
    "other-commercial",
    "floor",
    "building",
    "villa",
];

exports.propertyCreateVal = Joi.object({
    property: Joi.string()
        .valid("residential", "commercial")
        .required()
        .messages({
            "any.only": `"property" must be residential or commercial`,
            "string.empty": `"property" is required`,
        }),

    propertyType: Joi.string()
        .trim()
        .required()
        .when("property", {
            is: "residential",
            then: Joi.valid(...residentialTypes),
            otherwise: Joi.valid(...commercialTypes),
        })
        .messages({
            "any.only": `"propertyType" is invalid for selected property`,
            "string.empty": `"propertyType" is required`,
        }),


    listingCategory: Joi.string()
        .valid("buy", "rent", "sell")
        .trim()
        .required()
        .messages({
            "any.only": `"listingCategory" must be one of: buy, rent, sell`,
            "string.empty": `"listingCategory" is required`,
            "any.required": `"listingCategory" is required`
        }),

    localityArea: Joi.string().trim().required().messages({
        "string.empty": `"Locality / Area" is required`
    }),

    city: Joi.string().trim().required().messages({
        "string.empty": `"city" is required`
    }),

    price: Joi.string().trim().required().messages({
        "string.empty": `"price" is required`
    }),

    area: Joi.string().trim().required().messages({
        "string.empty": `"area" is required`
    }),

    bedRoom: Joi.string().trim().required().messages({
        "string.empty": `"bedRoom" is required`
    }),

    amenities: Joi.array().items(Joi.string()).min(1).required().messages({
        "array.min": `"amenities" must contain at least 1 item`,
        "any.required": `"amenities" is required`
    }),

    permitNo: Joi.string().trim().required().messages({
        "string.empty": `"permitNo" is required`
    }),

    rera: Joi.string().trim().required().messages({
        "string.empty": `"rera" is required`
    }),

    ded: Joi.string().trim().allow(null, ''),
    brn: Joi.string().trim().allow(null, ''),

    bathrooms: Joi.string().trim().required().messages({
        "string.empty": `"bathrooms" is required`
    }),

    furnishing: Joi.string()
        .valid("furnished", "semi-furnished", "unfurnished")
        .trim()
        .required()
        .messages({
            "any.only": `"furnishing" must be one of: furnished, semi-furnished, unfurnished`,
            "string.empty": `"furnishing" is required`,
            "any.required": `"furnishing" is required`
        }),

    aroundProject: Joi.array()
        .items(
            Joi.object({
                name: Joi.string().trim().required().messages({
                    "string.empty": `"aroundProject.name" is required`
                }),
                details: Joi.string().trim().required().messages({
                    "string.empty": `"aroundProject.details" is required`
                }),
            })
        )
        .allow(null, {}),

    description: Joi.string().trim().required().messages({
        "string.empty": `"description" is required`
    }),

    aveneuOverView: Joi.object({
        projectArea: Joi.string().trim().required().messages({
            "string.empty": `"projectArea" is required`
        }),
        size: Joi.string().trim().required().messages({
            "string.empty": `"size" is required`
        }),
        projectSize: Joi.string().trim().required().messages({
            "string.empty": `"projectSize" is required`
        }),
        launchDate: Joi.string().trim().required().messages({
            "string.empty": `"launchDate" is required`
        }),
        possessionStart: Joi.string().trim().required().messages({
            "string.empty": `"possessionStart" is required`
        }),
    }),

    propertyAddress: Joi.string().trim().required().messages({
        "string.empty": `"propertyAddress" is required`
    }),

    uploadedPhotos: Joi.array().items(Joi.string()).min(1).required().messages({
        "array.min": `"uploadedPhotos" must contain at least 1 photo`,
        "any.required": `"uploadedPhotos" is required`
    }),
});



exports.updatePropertySchema = Joi.object({
    id: Joi.string().trim().required().messages({
        "string.empty": `"id" is required`
    }),

    property: Joi.string()
        .valid("residential", "commercial")
        .required()
        .messages({
            "any.only": `"property" must be residential or commercial`,
            "string.empty": `"property" is required`,
        }),

    propertyType: Joi.string()
        .trim()
        .required()
        .when("property", {
            is: "residential",
            then: Joi.valid(...residentialTypes),
            otherwise: Joi.valid(...commercialTypes),
        })
        .messages({
            "any.only": `"propertyType" is invalid for selected property`,
            "string.empty": `"propertyType" is required`,
        }),


    listingCategory: Joi.string()
        .valid("buy", "rent", "sell")
        .trim()
        .required()
        .messages({
            "any.only": `"listingCategory" must be one of: buy, rent, sell`,
            "string.empty": `"listingCategory" is required`,
            "any.required": `"listingCategory" is required`
        }),

    localityArea: Joi.string().trim().required().messages({
        "string.empty": `"Locality / Area" is required`
    }),

    city: Joi.string().trim().required().messages({
        "string.empty": `"city" is required`
    }),

    price: Joi.string().trim().required().messages({
        "string.empty": `"price" is required`
    }),

    area: Joi.string().trim().required().messages({
        "string.empty": `"area" is required`
    }),

    bedRoom: Joi.string().trim().required().messages({
        "string.empty": `"bedRoom" is required`
    }),

    amenities: Joi.array().items(Joi.string()).min(1).required().messages({
        "array.min": `"amenities" must contain at least 1 item`,
        "any.required": `"amenities" is required`
    }),

    permitNo: Joi.string().trim().required().messages({
        "string.empty": `"permitNo" is required`
    }),

    rera: Joi.string().trim().required().messages({
        "string.empty": `"rera" is required`
    }),

    ded: Joi.string().trim().allow(null, ''),
    brn: Joi.string().trim().allow(null, ''),

    bathrooms: Joi.string().trim().required().messages({
        "string.empty": `"bathrooms" is required`
    }),

    furnishing: Joi.string()
        .valid("furnished", "semi-furnished", "unfurnished")
        .trim()
        .required()
        .messages({
            "any.only": `"furnishing" must be one of: furnished, semi-furnished, unfurnished`,
            "string.empty": `"furnishing" is required`,
            "any.required": `"furnishing" is required`
        }),

    aroundProject: Joi.array()
        .items(
            Joi.object({
                name: Joi.string().trim().required().messages({
                    "string.empty": `"aroundProject.name" is required`
                }),
                details: Joi.string().trim().required().messages({
                    "string.empty": `"aroundProject.details" is required`
                }),
            })
        )
        .allow(null, {}),

    description: Joi.string().trim().required().messages({
        "string.empty": `"description" is required`
    }),

    aveneuOverView: Joi.object({
        projectArea: Joi.string().trim().required().messages({
            "string.empty": `"projectArea" is required`
        }),
        size: Joi.string().trim().required().messages({
            "string.empty": `"size" is required`
        }),
        projectSize: Joi.string().trim().required().messages({
            "string.empty": `"projectSize" is required`
        }),
        launchDate: Joi.string().trim().required().messages({
            "string.empty": `"launchDate" is required`
        }),
        possessionStart: Joi.string().trim().required().messages({
            "string.empty": `"possessionStart" is required`
        }),
    }),

    propertyAddress: Joi.string().trim().required().messages({
        "string.empty": `"propertyAddress" is required`
    }),

    uploadedPhotos: Joi.array().items(Joi.string()).min(1).required().messages({
        "array.min": `"uploadedPhotos" must contain at least 1 photo`,
        "any.required": `"uploadedPhotos" is required`
    }),
});
