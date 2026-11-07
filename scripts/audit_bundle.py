import os
import re
import base64

# Términos ofuscados para auditoría forense sin exponerlos en el código del repositorio
encoded_terms = [
    b'acOxaWdv',
    b'aW5pZ28=',
    b'eWFpemE=',
    b'bXV0aWx2YQ==',
    b'MzExOTI=',
    b'YmVyZ2Vy',
    b'aGlwb3Rpcm9pZGlzbW8=',
    b'bmVmcm9wYXRpYQ==',
    b'bWFwYWNoaW9uYQ=='
]
terms = [base64.b64decode(t).decode('utf-8') for t in encoded_terms]
dist_dir = os.path.join('app', 'dist')

# El paquete cifrado (y perfiles_encrypted) va en el JS como base64 aleatorio. En cientos de KB
# de base64 salen por puro azar palabras cortas como las de la lista (sin distinguir mayúsculas,
# ~4 % de los despliegues), lo que dio un falso positivo el 7 nov 2026. Se quitan las tiradas
# largas de caracteres base64 antes de buscar: un nombre en claro va entre comillas o espacios
# y nunca dentro de una tirada así, de modo que una fuga real se sigue detectando.
BASE64_LARGO = re.compile(r'[A-Za-z0-9+/=]{200,}')

print("=== AUDITANDO ARTIFACTS DE PRODUCCIÓN EN app/dist/ ===")
leaks = []

for root, _, files in os.walk(dist_dir):
    for f in files:
        fpath = os.path.join(root, f)
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as fp:
            content = BASE64_LARGO.sub(' ', fp.read())
            for term in terms:
                count = len(re.findall(re.escape(term), content, re.I))
                if count > 0:
                    leaks.append((fpath, term, count))
                    print(f" [!] FUGA DETECTADA en {fpath}")
                else:
                    pass

if not leaks:
    print("[OK] AUDITORÍA SUPERADA: Cero nombres reales, cero ubicaciones personales y cero diagnósticos médicos en app/dist/.")
else:
    print(f"\n[ERROR] Se encontraron {len(leaks)} fugas en app/dist/.")
    exit(1)
