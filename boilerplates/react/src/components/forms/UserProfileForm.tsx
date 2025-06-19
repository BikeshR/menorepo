import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { type UserProfileFormData, userProfileSchema } from "@/lib/validations";

const availableSkills = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "Java",
  "Go",
  "Rust",
  "Docker",
  "Kubernetes",
];

export function UserProfileForm() {
  const newsletterId = useId();
  const notificationsId = useId();
  const themeId = useId();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserProfileFormData>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      bio: "",
      website: "",
      preferences: {
        newsletter: false,
        notifications: true,
        theme: "system",
      },
      skills: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "skills",
  });

  const watchedSkills = watch("skills");

  const onSubmit = async (data: UserProfileFormData) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Form submitted:", data);
    alert("Profile updated successfully!");
  };

  const addSkill = (skill: string) => {
    if (!watchedSkills.some((s) => s.value === skill)) {
      append({ value: skill });
    }
  };

  const removeSkill = (index: number) => {
    remove(index);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-center text-3xl font-bold tracking-tight">User Profile</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          React Hook Form + Zod Validation Example
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Personal Information</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium">
                First Name *
              </label>
              <input
                {...register("firstName")}
                className={cn(
                  "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  errors.firstName && "border-red-500"
                )}
                placeholder="John"
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium">
                Last Name *
              </label>
              <input
                {...register("lastName")}
                className={cn(
                  "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  errors.lastName && "border-red-500"
                )}
                placeholder="Doe"
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email *
            </label>
            <input
              {...register("email")}
              type="email"
              className={cn(
                "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                errors.email && "border-red-500"
              )}
              placeholder="john.doe@example.com"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium">
              Phone
            </label>
            <input
              {...register("phone")}
              type="tel"
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div>
            <label htmlFor="website" className="block text-sm font-medium">
              Website
            </label>
            <input
              {...register("website")}
              type="url"
              className={cn(
                "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                errors.website && "border-red-500"
              )}
              placeholder="https://johndoe.com"
            />
            {errors.website && (
              <p className="mt-1 text-sm text-red-600">{errors.website.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium">
              Bio
            </label>
            <textarea
              {...register("bio")}
              rows={3}
              className={cn(
                "mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                errors.bio && "border-red-500"
              )}
              placeholder="Tell us about yourself..."
            />
            {errors.bio && <p className="mt-1 text-sm text-red-600">{errors.bio.message}</p>}
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Skills *</h3>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {availableSkills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => addSkill(skill)}
                  disabled={watchedSkills.some((s) => s.value === skill)}
                  className={cn(
                    "rounded-md border px-3 py-1 text-sm transition-colors",
                    watchedSkills.some((s) => s.value === skill)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent"
                  )}
                >
                  {skill}
                </button>
              ))}
            </div>

            {watchedSkills.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Selected Skills:</p>
                <div className="flex flex-wrap gap-2">
                  {fields.map((field, index) => (
                    <span
                      key={field.id}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-sm text-primary-foreground"
                    >
                      {field.value}
                      <button
                        type="button"
                        onClick={() => removeSkill(index)}
                        className="ml-1 text-primary-foreground/80 hover:text-primary-foreground"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {errors.skills && <p className="text-sm text-red-600">{errors.skills.message}</p>}
          </div>
        </div>

        {/* Preferences */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Preferences</h3>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                {...register("preferences.newsletter")}
                type="checkbox"
                id={newsletterId}
                className="rounded border-input"
              />
              <label htmlFor={newsletterId} className="text-sm">
                Subscribe to newsletter
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                {...register("preferences.notifications")}
                type="checkbox"
                id={notificationsId}
                className="rounded border-input"
              />
              <label htmlFor={notificationsId} className="text-sm">
                Enable notifications
              </label>
            </div>

            <div>
              <label htmlFor={themeId} className="block text-sm font-medium">
                Theme
              </label>
              <select
                {...register("preferences.theme")}
                id={themeId}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Updating Profile..." : "Update Profile"}
        </button>
      </form>
    </div>
  );
}
