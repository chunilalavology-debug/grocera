import React from 'react';
import { motion } from 'framer-motion';

const Loader = () => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md z-[9999]"
    >
        <div className="relative flex items-center justify-center">
            {/* Outer Ring */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-20 h-20 border-4 border-gray-100 border-t-blue-600 rounded-full"
            />
            {/* Inner Pulsing Circle */}
            <motion.div
                animate={{ scale: [0.8, 1.2, 0.8] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute w-8 h-8 bg-blue-500 rounded-full blur-sm opacity-50"
            />
        </div>
        <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="mt-4 text-blue-600 font-bold tracking-widest text-sm"
        >
            ZIPPYYY LOADING...
        </motion.p>
    </motion.div>
);

export default Loader