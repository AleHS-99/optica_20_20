from django.db import models
from django.core.validators import RegexValidator
from phonenumber_field.modelfields import PhoneNumberField
from django.forms import model_to_dict

# Create your models here.
class Paciente(models.Model):
    class Meta:
        verbose_name = "Paciente"
        verbose_name_plural = "Pacientes"
    
    id = models.AutoField(primary_key=True)
    ci = models.CharField(
        max_length=11,
        unique=True,
        verbose_name="Carnet de Identidad",
        validators=[
            RegexValidator(
                regex=r'^\d{11}$',
                message='El CI debe tener exactamente 11 dígitos numéricos'
            )
        ],
        null=False,
        blank=False
    )
    nombre = models.CharField(
        max_length=50,
        verbose_name='Nombre',
        null=False,
        blank=False
    )
    apell1 = models.CharField(
        max_length=80,
        verbose_name='Apellido 1',
        null=False,
        blank=False
    )
    apell2 = models.CharField(
        max_length=80,
        verbose_name='Apellido 2',
        null=False,
        blank=False
    )
    telefono = PhoneNumberField(
        blank=True,
        null=True,
        verbose_name="Teléfono",
        region="CU"  # Para Cuba
    )
    direccion = models.TextField(verbose_name="Dirección", blank=True,null=True)
    
    def toJSON(self):
        item = model_to_dict(self)
        item['telefono'] = str(self.telefono)
        return item
    
    