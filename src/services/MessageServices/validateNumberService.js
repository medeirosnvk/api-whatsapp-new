const validateAndFormatNumber = async (number) => {
  if (typeof number !== "string") {
    throw new Error("Number must be a string");
  }

  // Remove qualquer caractere não numérico
  const cleanedNumber = number.replace(/\D/g, "");

  // Valida o comprimento do número (deve ser 12 ou 13 dígitos)
  if (cleanedNumber.length < 12 || cleanedNumber.length > 13) {
    throw new Error("Invalid phone number length: must be 12 or 13 digits");
  }

  let formattedNumber;

  // Se o número tiver 13 dígitos, remove o nono dígito extra
  if (cleanedNumber.length === 13) {
    // Mantém o código do país e do estado, e remove o nono dígito extra
    formattedNumber = cleanedNumber.slice(0, 4) + cleanedNumber.slice(5);
  } else {
    // Se o número tem 12 dígitos, usa como está
    formattedNumber = cleanedNumber;
  }

  // Garante que o número começa com o código do país
  if (!formattedNumber.startsWith("55")) {
    throw new Error("Invalid country code: must start with 55");
  }

  // Retorna o número formatado
  return formattedNumber;
};

module.exports = { validateAndFormatNumber };
