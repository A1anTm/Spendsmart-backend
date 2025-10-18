import jwt from 'jsonwebtoken';


export const generatetoken = (user) => {
    console.info('[generatetoken] Generando token para usuario:', user.email);
    const token = jwt.sign(
        {
            _id: user._id,
            full_name: user.full_name,
            email: user.email,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1m",
        }
    );
    console.info('[generatetoken] Token generado exitosamente', token);
    return token;
};

export const isAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    console.log('[isAuth] Authorization header:', JSON.stringify(authHeader));

    const token = authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]?.trim()   
        : null;

    if (!token || token.split('.').length !== 3) {   
        console.info('[isAuth] Token mal formado o faltante');
        return res.status(401).json({ message: 'Token inválido.' });
    }

    try {
        console.info('[isAuth] Verificando token...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { clockTolerance: 30 });
        req.user = decoded;
        next();
    } catch (error) {
        console.error('[isAuth] Error al verificar:', error.message);
        return res.status(401).json({ message: 'Token inválido o expirado.' });
    }
    };


export const generateTokenEmail = (userId) => {
    console.info('[generateTokenEmail] Generando token de restablecimiento para userId:', userId);
    const token = jwt.sign({ id: userId }, process.env.PASSWORD, { expiresIn: '10m' });
    console.info('[generateTokenEmail] Token de restablecimiento generado', token);
    return token;
};